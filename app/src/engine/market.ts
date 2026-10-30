import { OrderBook } from "./orderbook";
import type {
  Account,
  AuditEntry,
  Command,
  CommandResult,
  Direction,
  EngineEvent,
  EventOptions,
  MarketMakerParams,
  Order,
  Phase,
  RoundSummary,
  Scenario,
  ScenarioRound,
  Side,
  Team,
  Trade,
} from "./types";
import { LEGACY_OPTIONS, MM_ID } from "./types";
import { markToMarket, maxDrawdownPct, rankTeams, referenceValue } from "./valuation";

class Reject extends Error {}
const reject = (msg: string): never => {
  throw new Reject(msg);
};

/** Phases the server clock runs (and the organiser can pause or skip). */
export const TIMED_PHASES = ["BRIEFING", "NEWS", "TRADING", "SETTLING"];

interface RoundStartState {
  accounts: Map<string, Account>;
  lastPrice: Record<string, number | null>;
  rv: Record<string, number>;
  fundamental: Record<string, number>;
  rvHistoryLen: number;
  summariesLen: number;
  tradesLen: number;
}

/**
 * The authoritative market. Deterministic: every state change happens in
 * `apply(command)`, and every command carries its own server timestamp and any
 * generated ids. Replaying the same command log rebuilds the same state, which
 * is how the server recovers after a crash and how the audit trail is verified.
 *
 * JavaScript is single-threaded, so each `apply` is atomic: no two orders can
 * interleave, overspend cash or double-execute.
 */
export class Market {
  readonly params: Scenario["params"];
  readonly tickers: string[];
  readonly maxShares: Record<string, number> = {};
  readonly endowment: Record<string, number> = {};
  readonly startingCash: number;

  phase: Phase = "LOBBY";
  round = 0;
  phaseEndsAt: number | null = null;
  paused = false;
  pausedRemainingMs = 0;
  debriefRevealed = false;
  finishedReason: string | null = null;
  options: EventOptions = { ...LEGACY_OPTIONS };

  teams: Team[] = [];
  readonly teamById = new Map<string, Team>();
  accounts = new Map<string, Account>();
  readonly books = new Map<string, OrderBook>();
  readonly orders = new Map<string, Order>();
  readonly openByTeam = new Map<string, Set<string>>();
  readonly trades: Trade[] = [];
  readonly summaries: RoundSummary[] = [];
  readonly audit: AuditEntry[] = [];

  /** Last published reference value per stock (cents). */
  rv: Record<string, number> = {};
  /** RV at the start of the current round (MM anchors on this). */
  rvStart: Record<string, number> = {};
  /** rvHistory[i] = RV map after round i (index 0 = opening). */
  readonly rvHistory: Record<string, number>[] = [];
  /** Hidden fundamental value (float cents). Never sent to participants. */
  fundamental: Record<string, number> = {};
  lastPrice: Record<string, number | null> = {};
  /** Net cents teams have bought from the market maker this round, per stock. */
  mmNet: Record<string, number> = {};
  mm: MarketMakerParams;

  /** Domain events for persistence projections. The server drains this after each apply. */
  outbox: EngineEvent[] = [];

  private orderSeq = 0;
  private tradeSeq = 0;
  private auditSeq = 0;
  private mmSeq = 0;
  private recent = new Map<string, number[]>();
  private clientIds = new Map<string, Map<string, string>>();
  private dirty = new Set<string>();
  private roundStart: RoundStartState | null = null;

  constructor(readonly scenario: Scenario) {
    this.params = scenario.params;
    this.mm = scenario.params.marketMaker;
    this.tickers = scenario.stocks.map((s) => s.ticker);
    let endowValue = 0;
    for (const s of scenario.stocks) {
      const px = Math.round(s.startPrice * 100);
      this.books.set(s.ticker, new OrderBook(s.ticker));
      this.rv[s.ticker] = px;
      this.fundamental[s.ticker] = px;
      this.lastPrice[s.ticker] = null;
      this.mmNet[s.ticker] = 0;
      this.endowment[s.ticker] = Math.round(this.params.endowmentPerStock / s.startPrice);
      this.maxShares[s.ticker] = Math.floor(this.params.maxPositionValuePerStock / s.startPrice);
      endowValue += this.endowment[s.ticker] * px;
    }
    // Cash tops the share endowment up to exactly the starting capital.
    this.startingCash = this.params.startingCapital * 100 - endowValue;
    this.rvStart = { ...this.rv };
    this.rvHistory.push({ ...this.rv });
  }

  get currentRound(): ScenarioRound | undefined {
    return this.scenario.rounds[this.round - 1];
  }

  // ============================================================== commands
  apply(cmd: Command): CommandResult {
    try {
      const data = this.dispatch(cmd);
      if (data && typeof data === "object" && (data as { duplicate?: boolean }).duplicate) {
        return { ok: true, duplicate: true, data };
      }
      this.flushMarketMaker(cmd.ts);
      return { ok: true, data };
    } catch (e) {
      if (e instanceof Reject) return { ok: false, error: e.message };
      throw e;
    }
  }

  private dispatch(cmd: Command): unknown {
    switch (cmd.type) {
      case "SETUP_TEAMS":
        return this.setupTeams(cmd.teams, cmd.ts, cmd.options ?? LEGACY_OPTIONS);
      case "START":
        if (this.phase !== "LOBBY") reject("Event already started");
        if (this.teams.length === 0) reject("No teams registered");
        this.log(cmd.ts, "admin", "START", `Event started with ${this.teams.length} teams`);
        if (this.options.briefingSeconds > 0) {
          this.phase = "BRIEFING";
          this.phaseEndsAt = cmd.ts + this.options.briefingSeconds * 1000;
          this.log(cmd.ts, "clock", "BRIEFING", `Company briefing: ${Math.round(this.options.briefingSeconds / 60 * 10) / 10} min before Round 1`);
        } else this.startRound(1, cmd.ts);
        return null;
      case "ADVANCE":
        return this.advance(cmd.ts, cmd.actor ?? "admin");
      case "PAUSE":
        if (!TIMED_PHASES.includes(this.phase) || this.paused) reject("Nothing to pause");
        // At least 30 s remain after a resume, so an auto-pause after a restart never resumes into an instant close.
        this.pausedRemainingMs = Math.max(30_000, (this.phaseEndsAt ?? cmd.ts) - cmd.ts);
        this.paused = true;
        this.phaseEndsAt = null;
        this.log(cmd.ts, "admin", "PAUSE", `Paused in round ${this.round} ${this.phase} with ${Math.round(this.pausedRemainingMs / 1000)}s left`);
        return null;
      case "RESUME":
        if (!this.paused) reject("Not paused");
        this.paused = false;
        this.phaseEndsAt = cmd.ts + this.pausedRemainingMs;
        this.log(cmd.ts, "admin", "RESUME", `Resumed round ${this.round} ${this.phase}`);
        return null;
      case "RESTART_ROUND":
        if (!["NEWS", "TRADING", "SETTLING"].includes(this.phase)) reject("No round in progress");
        this.voidCurrentRound(cmd.ts, cmd.reason);
        this.paused = false;
        this.startRound(this.round, cmd.ts);
        return null;
      case "TERMINATE":
        if (this.phase === "FINISHED") reject("Already finished");
        if (this.phase === "NEWS" || this.phase === "TRADING") this.voidCurrentRound(cmd.ts, cmd.reason);
        this.paused = false;
        this.finish(cmd.ts, `Terminated: ${cmd.reason}`);
        return null;
      case "REVEAL_DEBRIEF":
        if (this.phase !== "FINISHED") reject("Debrief can only be revealed after the event");
        this.debriefRevealed = true;
        this.log(cmd.ts, "admin", "REVEAL_DEBRIEF", "Scenario truths revealed to participants");
        return null;
      case "ADMIN_AUDIT":
        this.log(cmd.ts, "admin", cmd.action, cmd.detail);
        return null;
      case "PLACE_ORDER":
        return this.placeOrder(cmd);
      case "CANCEL_ORDER":
        return this.cancelCmd(cmd.teamId, cmd.orderId, cmd.ts);
      case "MODIFY_ORDER":
        return this.modifyOrder(cmd.teamId, cmd.orderId, cmd.price, cmd.qty, cmd.ts);
      case "BUY_RESEARCH":
        return this.buyResearch(cmd.teamId, cmd.researchId, cmd.ts);
      case "SUBMIT_FORECAST":
        return this.submitForecast(cmd.teamId, cmd.round, cmd.direction, cmd.ts);
    }
  }

  // ============================================================== lifecycle
  private setupTeams(teams: Omit<Team, "group">[], ts: number, options: EventOptions) {
    if (this.phase !== "LOBBY") reject("Teams can only be registered in the lobby");
    this.options = { ...options };
    const holdings = options.startWithHoldings;
    const groups = this.params.groups;
    this.teams = teams.map((t) => ({ ...t, group: groups[(t.number - 1) % groups.length] }));
    this.teamById.clear();
    this.accounts.clear();
    for (const t of this.teams) {
      this.teamById.set(t.id, t);
      const positions: Account["positions"] = {};
      const reservedShares: Account["reservedShares"] = {};
      for (const s of this.scenario.stocks) {
        positions[s.ticker] = { shares: holdings ? this.endowment[s.ticker] : 0, avgCost: Math.round(s.startPrice * 100), realized: 0 };
        reservedShares[s.ticker] = 0;
      }
      this.accounts.set(t.id, {
        teamId: t.id,
        cash: holdings ? this.startingCash : this.params.startingCapital * 100,
        reservedCash: 0,
        positions,
        reservedShares,
        researchCredits: this.params.researchCredits,
        research: [],
        forecasts: {},
        forecastScore: 0,
        snapshots: [],
        maxDrawdownPct: 0,
      });
      this.openByTeam.set(t.id, new Set());
    }
    this.outbox.push({ kind: "TEAMS", teams: this.teams });
    const opts = [
      options.briefingSeconds ? `${Math.round(options.briefingSeconds / 60 * 10) / 10} min briefing` : "no briefing",
      holdings ? "cash + holdings" : "all cash, zero holdings",
    ];
    this.log(ts, "admin", "SETUP_TEAMS", `${this.teams.length} teams registered (${opts.join("; ")})`);
    return { teams: this.teams.length };
  }

  private startRound(r: number, ts: number) {
    this.round = r;
    this.phase = "NEWS";
    this.phaseEndsAt = ts + this.params.newsSeconds * 1000;
    this.rvStart = { ...this.rv };
    this.mm = this.currentRound?.marketMaker ?? this.params.marketMaker;
    for (const t of this.tickers) this.mmNet[t] = 0;
    this.roundStart = {
      accounts: structuredClone(this.accounts),
      lastPrice: { ...this.lastPrice },
      rv: { ...this.rv },
      fundamental: { ...this.fundamental },
      rvHistoryLen: this.rvHistory.length,
      summariesLen: this.summaries.length,
      tradesLen: this.trades.length,
    };
    this.outbox.push({ kind: "ROUND_STARTED", round: r, ts });
    this.log(ts, "clock", "ROUND_NEWS", `Round ${r} news released`);
  }

  private advance(ts: number, actor: string) {
    if (this.paused) reject("Paused");
    switch (this.phase) {
      case "BRIEFING":
        this.startRound(1, ts);
        return null;
      case "NEWS":
        this.phase = "TRADING";
        this.phaseEndsAt = ts + this.params.tradingSeconds * 1000;
        for (const t of this.tickers) this.dirty.add(t);
        this.log(ts, actor, "TRADING_OPEN", `Round ${this.round} trading open`);
        return null;
      case "TRADING":
        this.settle(ts, actor);
        return null;
      case "SETTLING":
        if (this.round < this.params.rounds) this.startRound(this.round + 1, ts);
        else this.finish(ts, "Completed all rounds");
        return null;
      default:
        return reject(`Cannot advance from ${this.phase}`);
    }
  }

  /** Is the current phase past its deadline? The server clock calls ADVANCE when true. */
  isDue(now: number): boolean {
    return !this.paused && this.phaseEndsAt !== null && now >= this.phaseEndsAt && TIMED_PHASES.includes(this.phase);
  }

  private settle(ts: number, actor: string) {
    const r = this.round;
    this.phase = "SETTLING";
    this.phaseEndsAt = ts + this.params.settleSeconds * 1000;
    this.dirty.clear();
    // 1. Stop trading and cancel every outstanding order (team and market maker).
    for (const book of this.books.values()) {
      for (const o of book.clear()) this.closeOrder(o, "CANCELLED");
    }
    // 2-3. Apply the scripted fundamental change and compute reference values.
    const round = this.currentRound!;
    const vwap: Record<string, number | null> = {};
    const volume: Record<string, number> = {};
    const roundTrades = this.trades.filter((t) => t.round === r && !t.voided);
    for (const t of this.tickers) {
      this.fundamental[t] *= 1 + (round.fundamentals[t] ?? 0) / 100;
      const res = referenceValue(
        this.fundamental[t],
        roundTrades.filter((x) => x.ticker === t),
        this.params.referenceValue,
      );
      this.rv[t] = res.rv;
      vwap[t] = res.vwap;
      volume[t] = res.volume;
    }
    this.rvHistory.push({ ...this.rv });
    // 4-5. Mark every portfolio to the same reference values.
    const snapshots: Record<string, ReturnType<typeof markToMarket>> = {};
    const positions: Record<string, Account["positions"]> = {};
    for (const acc of this.accounts.values()) {
      const snap = markToMarket(acc, this.rv, r);
      acc.snapshots.push(snap);
      acc.maxDrawdownPct = maxDrawdownPct(this.params.startingCapital * 100, acc.snapshots.map((s) => s.equity));
      snapshots[acc.teamId] = snap;
      positions[acc.teamId] = structuredClone(acc.positions);
    }
    // Forecasts: scored on the published RV, separately from equity.
    if (round.forecast) {
      const t = round.forecast.ticker;
      const correct: Direction | null = this.rv[t] > this.rvStart[t] ? "UP" : this.rv[t] < this.rvStart[t] ? "DOWN" : null;
      for (const acc of this.accounts.values()) {
        if (correct && acc.forecasts[r] === correct) acc.forecastScore += this.params.forecastPoints;
      }
    }
    // 6. Leaderboard and round summary.
    const leaderboard = rankTeams(this.teams, this.accounts, this.rv, this.params.startingCapital * 100);
    const summary: RoundSummary = { round: r, rvStart: { ...this.rvStart }, rvEnd: { ...this.rv }, vwap, volume, trades: roundTrades.length, leaderboard };
    this.summaries.push(summary);
    this.outbox.push({ kind: "ROUND_SETTLED", summary, snapshots, positions });
    this.log(ts, actor, "ROUND_SETTLED", `Round ${r} settled: ${roundTrades.length} trades; leader ${leaderboard[0]?.teamName ?? "-"}`);
  }

  private finish(ts: number, reason: string) {
    this.phase = "FINISHED";
    this.phaseEndsAt = null;
    this.finishedReason = reason;
    this.log(ts, "clock", "FINISHED", reason);
  }

  /** Restore the state captured at the start of the round; keep research purchases (information already seen). */
  private voidCurrentRound(ts: number, reason: string) {
    const snap = this.roundStart;
    if (!snap) return;
    for (const book of this.books.values()) {
      for (const o of book.clear()) {
        o.status = "CANCELLED";
        if (o.teamId !== MM_ID) {
          this.openByTeam.get(o.teamId)?.delete(o.id);
          this.outbox.push({ kind: "ORDER", order: { ...o } });
        }
      }
    }
    const restored = structuredClone(snap.accounts);
    for (const [id, acc] of restored) {
      const cur = this.accounts.get(id)!;
      acc.research = cur.research;
      acc.researchCredits = cur.researchCredits;
    }
    this.accounts = restored;
    this.lastPrice = { ...snap.lastPrice };
    this.rv = { ...snap.rv };
    this.fundamental = { ...snap.fundamental };
    this.rvHistory.length = snap.rvHistoryLen;
    this.summaries.length = snap.summariesLen;
    for (let i = snap.tradesLen; i < this.trades.length; i++) this.trades[i].voided = true;
    this.dirty.clear();
    this.outbox.push({ kind: "ROUND_VOIDED", round: this.round, ts });
    this.log(ts, "admin", "ROUND_VOIDED", `Round ${this.round} voided and restored to its start: ${reason}`);
  }

  // ============================================================== orders
  private requireTeam(teamId: string) {
    const acc = this.accounts.get(teamId);
    if (!acc) reject("Unknown team");
    return acc!;
  }

  private requireTrading() {
    if (this.phase !== "TRADING") reject("Trading is closed");
    if (this.paused) reject("Market is paused");
  }

  private rateLimit(teamId: string, ts: number) {
    const win = this.params.rateLimit.windowSeconds * 1000;
    const list = (this.recent.get(teamId) ?? []).filter((t) => ts - t < win);
    if (list.length >= this.params.rateLimit.count) reject(`Too many actions: max ${this.params.rateLimit.count} per ${this.params.rateLimit.windowSeconds}s`);
    list.push(ts);
    this.recent.set(teamId, list);
  }

  private checkPrice(ticker: string, price: number) {
    if (!Number.isInteger(price) || price <= 0) reject("Price must be a positive amount with at most 2 decimals");
    const ref = this.rvStart[ticker];
    const band = this.params.limitPriceBandPct / 100;
    if (price < ref * (1 - band) || price > ref * (1 + band)) {
      reject(`Price must be within ±${this.params.limitPriceBandPct}% of the round's opening reference value (${(ref / 100).toFixed(2)})`);
    }
  }

  private openBuyShares(teamId: string, ticker: string, exclude?: string) {
    let n = 0;
    for (const id of this.openByTeam.get(teamId) ?? []) {
      const o = this.orders.get(id)!;
      if (o.ticker === ticker && o.side === "BUY" && o.id !== exclude) n += o.remaining;
    }
    return n;
  }

  /** Buy orders are capped per order; sells are limited only by shares held. */
  private checkBuyNotional(value: number) {
    const cap = this.params.maxBuyOrderNotional;
    if (value > cap * 100) reject(`Buy order value exceeds the ${cap.toLocaleString()} credit limit per order`);
  }

  private placeOrder(cmd: Extract<Command, { type: "PLACE_ORDER" }>) {
    const { teamId, ticker, side, orderType, qty, ts } = cmd;
    const acc = this.requireTeam(teamId);
    if (cmd.clientOrderId) {
      const prev = this.clientIds.get(teamId)?.get(cmd.clientOrderId);
      if (prev) return { duplicate: true, orderId: prev };
    }
    this.requireTrading();
    const book = this.books.get(ticker) ?? reject("Unknown stock");
    if (!Number.isInteger(qty) || qty < 1) reject("Quantity must be a whole number of shares");
    if (side !== "BUY" && side !== "SELL") reject("Invalid side");
    if (orderType !== "LIMIT" && orderType !== "MARKET") reject("Invalid order type");

    let limit: number;
    if (orderType === "LIMIT") {
      limit = cmd.price ?? reject("Limit orders need a price");
      this.checkPrice(ticker, limit);
      if ((this.openByTeam.get(teamId)?.size ?? 0) >= this.params.maxOpenOrders) reject(`Maximum ${this.params.maxOpenOrders} open orders`);
    } else {
      const best = book.best(side === "BUY" ? "SELL" : "BUY");
      const collar = this.params.marketOrderCollarPct / 100;
      if (!best) {
        // No liquidity: the order is recorded as unfilled; nothing changes.
        this.rateLimit(teamId, ts);
        const o = this.newOrder(cmd, 0);
        o.status = "UNFILLED";
        this.orders.set(o.id, o);
        this.rememberClientId(teamId, cmd.clientOrderId, o.id);
        this.outbox.push({ kind: "ORDER", order: { ...o } });
        return this.orderResult(o);
      }
      limit = side === "BUY" ? Math.ceil(best.price * (1 + collar)) : Math.floor(best.price * (1 - collar));
    }
    const pos = acc.positions[ticker];
    if (side === "BUY") {
      this.checkBuyNotional(qty * limit);
      if (qty * limit > acc.cash - acc.reservedCash) reject("Insufficient available cash");
      if (pos.shares + this.openBuyShares(teamId, ticker) + qty > this.maxShares[ticker]) reject(`Position limit: max ${this.maxShares[ticker]} shares of ${ticker} (including open buy orders)`);
    } else if (qty > pos.shares - acc.reservedShares[ticker]) {
      reject("Insufficient shares (short selling is not allowed)");
    }
    this.rateLimit(teamId, ts);

    const order = this.newOrder(cmd, limit);
    this.orders.set(order.id, order);
    this.rememberClientId(teamId, cmd.clientOrderId, order.id);
    if (side === "BUY") acc.reservedCash += qty * limit;
    else acc.reservedShares[ticker] += qty;
    this.openByTeam.get(teamId)!.add(order.id);

    this.execute(order, book, ts);
    if (order.remaining > 0) {
      if (orderType === "MARKET") this.closeOrder(order, order.filled > 0 ? "CANCELLED" : "UNFILLED");
      else {
        book.add(order);
        order.status = order.filled > 0 ? "PARTIAL" : "OPEN";
      }
    }
    this.outbox.push({ kind: "ORDER", order: { ...order } });
    return this.orderResult(order);
  }

  private newOrder(cmd: Extract<Command, { type: "PLACE_ORDER" }>, price: number): Order {
    return {
      id: cmd.orderId,
      teamId: cmd.teamId,
      ticker: cmd.ticker,
      side: cmd.side,
      type: cmd.orderType,
      price,
      qty: cmd.qty,
      remaining: cmd.qty,
      filled: 0,
      seq: ++this.orderSeq,
      ts: cmd.ts,
      round: this.round,
      status: "OPEN",
      clientOrderId: cmd.clientOrderId,
    };
  }

  private rememberClientId(teamId: string, clientOrderId: string | undefined, orderId: string) {
    if (!clientOrderId) return;
    if (!this.clientIds.has(teamId)) this.clientIds.set(teamId, new Map());
    this.clientIds.get(teamId)!.set(clientOrderId, orderId);
  }

  private orderResult(o: Order) {
    const fills = this.trades.filter((t) => !t.voided && t.round === this.round && (t.buyOrderId === o.id || t.sellOrderId === o.id));
    const value = fills.reduce((s, t) => s + t.price * t.qty, 0);
    const outcome =
      o.filled === 0 ? (o.type === "MARKET" ? "UNFILLED" : "RESTING") : o.filled === o.qty ? "FILLED" : o.type === "MARKET" ? "PARTIALLY_FILLED" : "PARTIALLY_FILLED_RESTING";
    return { orderId: o.id, outcome, filled: o.filled, remaining: o.status === "OPEN" || o.status === "PARTIAL" ? o.remaining : 0, avgPrice: o.filled ? Math.round(value / o.filled) : null };
  }

  /** Match `order` against the book and settle each fill. */
  private execute(order: Order, book: OrderBook, ts: number) {
    // Self-trade prevention: the older resting order is cancelled (visible to the team as a cancelled order).
    const fills = book.match(order, order.price, (resting) => this.closeOrder(resting, "CANCELLED"));
    for (const f of fills) this.settleFill(order, f.resting, f.qty, f.price, ts);
    if (order.remaining === 0) {
      order.status = "FILLED";
      this.openByTeam.get(order.teamId)?.delete(order.id);
    }
  }

  private settleFill(aggr: Order, resting: Order, qty: number, price: number, ts: number) {
    const buy = aggr.side === "BUY" ? aggr : resting;
    const sell = aggr.side === "BUY" ? resting : aggr;
    const trade: Trade = {
      id: `T${++this.tradeSeq}`,
      seq: this.tradeSeq,
      round: this.round,
      ticker: aggr.ticker,
      price,
      qty,
      ts,
      buyTeamId: buy.teamId,
      sellTeamId: sell.teamId,
      buyOrderId: buy.id,
      sellOrderId: sell.id,
      aggressor: aggr.side,
    };
    this.trades.push(trade);
    this.outbox.push({ kind: "TRADE", trade });
    this.lastPrice[trade.ticker] = price;
    const notional = price * qty;

    if (buy.teamId !== MM_ID) {
      const acc = this.accounts.get(buy.teamId)!;
      const pos = acc.positions[trade.ticker];
      acc.cash -= notional;
      acc.reservedCash -= buy.price * qty; // reservation was made at the order's limit/collar price
      pos.avgCost = (pos.shares * pos.avgCost + notional) / (pos.shares + qty);
      pos.shares += qty;
    }
    if (sell.teamId !== MM_ID) {
      const acc = this.accounts.get(sell.teamId)!;
      const pos = acc.positions[trade.ticker];
      acc.cash += notional;
      acc.reservedShares[trade.ticker] -= qty;
      pos.realized += (price - pos.avgCost) * qty;
      pos.shares -= qty;
    }
    if (buy.teamId === MM_ID || sell.teamId === MM_ID) {
      this.mmNet[trade.ticker] += buy.teamId === MM_ID ? -notional : notional;
      this.dirty.add(trade.ticker);
    }
    if (resting.teamId !== MM_ID) {
      if (resting.remaining === 0) this.openByTeam.get(resting.teamId)?.delete(resting.id);
      this.outbox.push({ kind: "ORDER", order: { ...resting } });
    }
  }

  /** Close an order and release whatever it still reserves. Caller removes it from the book. */
  private closeOrder(o: Order, status: "CANCELLED" | "UNFILLED") {
    o.status = status;
    if (o.teamId === MM_ID) return;
    const acc = this.accounts.get(o.teamId)!;
    if (o.side === "BUY") acc.reservedCash -= o.remaining * o.price;
    else acc.reservedShares[o.ticker] -= o.remaining;
    this.openByTeam.get(o.teamId)?.delete(o.id);
    this.outbox.push({ kind: "ORDER", order: { ...o } });
  }

  private ownOpenOrder(teamId: string, orderId: string) {
    const o = this.orders.get(orderId);
    if (!o || o.teamId !== teamId) reject("Order not found");
    if (o!.status !== "OPEN" && o!.status !== "PARTIAL") reject("Order is no longer open");
    return o!;
  }

  private cancelCmd(teamId: string, orderId: string, ts: number) {
    this.requireTeam(teamId);
    this.requireTrading();
    const o = this.ownOpenOrder(teamId, orderId);
    this.rateLimit(teamId, ts);
    this.books.get(o.ticker)!.remove(o.id);
    this.closeOrder(o, "CANCELLED");
    return { orderId, outcome: "CANCELLED" };
  }

  /**
   * Modify a resting limit order. Reducing quantity keeps time priority. Any
   * price change or quantity increase is a cancel-and-replace: the order gets a
   * new priority sequence and may execute immediately if it now crosses.
   */
  private modifyOrder(teamId: string, orderId: string, price: number | undefined, qty: number | undefined, ts: number) {
    const acc = this.requireTeam(teamId);
    this.requireTrading();
    const o = this.ownOpenOrder(teamId, orderId);
    const newPrice = price ?? o.price;
    const newQty = qty ?? o.remaining;
    if (!Number.isInteger(newQty) || newQty < 1) reject("Quantity must be a whole number of shares");
    if (newPrice === o.price && newQty === o.remaining) reject("Nothing to change");
    this.checkPrice(o.ticker, newPrice);
    const pos = acc.positions[o.ticker];
    if (o.side === "BUY") {
      this.checkBuyNotional(newQty * newPrice);
      const extra = newQty * newPrice - o.remaining * o.price;
      if (extra > acc.cash - acc.reservedCash) reject("Insufficient available cash");
      if (pos.shares + this.openBuyShares(teamId, o.ticker, o.id) + newQty > this.maxShares[o.ticker]) reject(`Position limit: max ${this.maxShares[o.ticker]} shares of ${o.ticker}`);
    } else if (newQty - o.remaining > pos.shares - acc.reservedShares[o.ticker]) {
      reject("Insufficient shares");
    }
    this.rateLimit(teamId, ts);
    const book = this.books.get(o.ticker)!;
    // Release the old reservation, apply the new one.
    if (o.side === "BUY") acc.reservedCash += newQty * newPrice - o.remaining * o.price;
    else acc.reservedShares[o.ticker] += newQty - o.remaining;

    if (newPrice === o.price && newQty < o.remaining) {
      o.qty -= o.remaining - newQty;
      o.remaining = newQty;
      this.outbox.push({ kind: "ORDER", order: { ...o } });
      return { orderId, outcome: "REDUCED_KEEPS_PRIORITY" };
    }
    book.remove(o.id);
    o.qty = o.filled + newQty;
    o.remaining = newQty;
    o.price = newPrice;
    o.seq = ++this.orderSeq;
    o.ts = ts;
    this.execute(o, book, ts);
    if (o.remaining > 0) {
      book.add(o);
      o.status = o.filled > 0 ? "PARTIAL" : "OPEN";
    }
    this.outbox.push({ kind: "ORDER", order: { ...o } });
    return { ...this.orderResult(o), priority: "RESET" };
  }

  // ============================================================== research & forecasts
  private buyResearch(teamId: string, researchId: string, ts: number) {
    const acc = this.requireTeam(teamId);
    if (this.phase !== "NEWS" && this.phase !== "TRADING") reject("Research is only available during a round");
    const item = this.currentRound?.research.find((r) => r.id === researchId) ?? reject("Research item not available this round");
    if (acc.research.includes(researchId)) reject("Already purchased");
    if (acc.researchCredits < 1) reject("No research credits left");
    acc.researchCredits -= 1;
    acc.research.push(researchId);
    this.outbox.push({ kind: "RESEARCH", teamId, researchId, round: this.round, ts });
    return { researchId, result: item.result };
  }

  /** Which round's forecast is open right now (submissions lock when trading opens). */
  openForecastRound(): number | null {
    const candidate =
      this.phase === "NEWS" ? this.round : this.phase === "SETTLING" ? this.round + 1 : this.phase === "LOBBY" || this.phase === "BRIEFING" ? 1 : null;
    if (!candidate || candidate > this.params.rounds) return null;
    return this.scenario.rounds[candidate - 1].forecast ? candidate : null;
  }

  private submitForecast(teamId: string, round: number, direction: Direction, ts: number) {
    const acc = this.requireTeam(teamId);
    if (direction !== "UP" && direction !== "DOWN") reject("Direction must be UP or DOWN");
    if (this.openForecastRound() !== round) reject("Forecast window is closed");
    acc.forecasts[round] = direction;
    const ticker = this.scenario.rounds[round - 1].forecast!.ticker;
    this.outbox.push({ kind: "FORECAST", teamId, round, ticker, direction, ts });
    return { round, direction };
  }

  // ============================================================== market maker
  /**
   * Disclosed market-maker rule. For each stock the MM quotes a ladder around
   *   mid = opening RV × (1 + skew),  skew = clamp(net team buying from MM / 10,000 × skewPctPer10k, ±maxSkew)
   * with `levels` price levels per side starting `halfSpreadPct` from mid, `levelStepPct` apart,
   * each worth `levelNotional` credits. It re-quotes after any fill against it.
   */
  private flushMarketMaker(ts: number) {
    if (this.phase !== "TRADING" || this.paused || this.dirty.size === 0) {
      this.dirty.clear();
      return;
    }
    const tickers = [...this.dirty];
    this.dirty.clear();
    for (const t of tickers) this.requote(t, ts);
    this.dirty.clear(); // one pass per command; later commands re-quote again
  }

  mmMid(ticker: string) {
    const m = this.mm;
    const raw = (this.mmNet[ticker] / 1_000_000) * (m.skewPctPer10k / 100);
    const skew = Math.max(-m.maxSkewPct / 100, Math.min(m.maxSkewPct / 100, raw));
    return this.rvStart[ticker] * (1 + skew);
  }

  private requote(ticker: string, ts: number) {
    const book = this.books.get(ticker)!;
    for (const o of book.all()) if (o.teamId === MM_ID) book.remove(o.id);
    const m = this.mm;
    const mid = this.mmMid(ticker);
    for (let i = 0; i < m.levels; i++) {
      const off = (m.halfSpreadPct + i * m.levelStepPct) / 100;
      for (const side of ["SELL", "BUY"] as Side[]) {
        const price = Math.max(1, Math.round(side === "SELL" ? mid * (1 + off) : mid * (1 - off)));
        const qty = Math.max(1, Math.round((m.levelNotional * 100) / price));
        const o: Order = {
          id: `M${++this.mmSeq}`,
          teamId: MM_ID,
          ticker,
          side,
          type: "LIMIT",
          price,
          qty,
          remaining: qty,
          filled: 0,
          seq: ++this.orderSeq,
          ts,
          round: this.round,
          status: "OPEN",
        };
        const fills = book.match(o, price, () => {});
        for (const f of fills) this.settleFill(o, f.resting, f.qty, f.price, ts);
        if (o.remaining > 0) book.add(o);
      }
    }
  }

  // ============================================================== helpers
  private log(ts: number, actor: string, action: string, detail: string) {
    const entry = { seq: ++this.auditSeq, ts, actor, action, detail };
    this.audit.push(entry);
    this.outbox.push({ kind: "AUDIT", entry });
  }

  drain(): EngineEvent[] {
    const out = this.outbox;
    this.outbox = [];
    return out;
  }

  /** Indicative equity at the current (round-start) reference values. */
  equityOf(teamId: string) {
    return markToMarket(this.accounts.get(teamId)!, this.rv, this.round);
  }

  /** Stable fingerprint of all state that matters for scoring (used by replay tests). */
  fingerprint(): string {
    return JSON.stringify({
      phase: this.phase,
      round: this.round,
      rv: this.rv,
      accounts: [...this.accounts.values()],
      trades: this.trades.map((t) => [t.id, t.price, t.qty, t.buyTeamId, t.sellTeamId, !!t.voided]),
      books: [...this.books.values()].map((b) => b.all().map((o) => [o.id, o.price, o.remaining, o.seq])),
    });
  }
}
