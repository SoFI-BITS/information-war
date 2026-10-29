// Read models sent to clients. These are the ONLY shapes that leave the server,
// so anything not copied here (team ids on orders/trades, hidden fundamentals,
// signal truth, group letters) can never leak to participants.
import type { Market } from "./market";
import type { Level } from "./orderbook";
import type { Direction, LeaderboardRow } from "./types";
import { MM_ID } from "./types";
import { rankTeams } from "./valuation";

const BOOK_DEPTH = 8;
const TAPE_LEN = 60;
const PRICES_PER_STOCK = 40;

export interface PublicStock {
  ticker: string;
  name: string;
  sector: string;
  description: string;
  volatility: string;
  links: string;
  startPrice: number;
  rv: number;
  rvPrev: number;
  lastPrice: number | null;
  bids: Level[];
  asks: Level[];
  roundVolume: number;
  roundHigh: number | null;
  roundLow: number | null;
  history: number[];
  recentPrices: number[];
}

export interface PublicView {
  serverTime: number;
  name: string;
  phase: string;
  round: number;
  totalRounds: number;
  roundTitle: string | null;
  phaseEndsAt: number | null;
  paused: boolean;
  pausedRemainingMs: number;
  stocks: PublicStock[];
  tape: { ticker: string; price: number; qty: number; time: number }[];
  news: { round: number; headline: string; body: string }[];
  forecast: { round: number; ticker: string; question: string } | null;
  research: { id: string; title: string; cost: number }[];
  roundResults: { round: number; rvEnd: Record<string, number>; rvStart: Record<string, number>; top: { rank: number; teamName: string; equity: number; returnPct: number }[] }[];
  finalLeaderboard: LeaderboardRow[] | null;
  finishedReason: string | null;
  debrief: unknown | null;
  rules: Record<string, unknown>;
}

export function publicView(m: Market, now: number): PublicView {
  const perStock: Record<string, number[]> = {};
  const vol: Record<string, number> = {};
  const hi: Record<string, number> = {};
  const lo: Record<string, number> = {};
  for (const t of m.tickers) {
    perStock[t] = [];
    vol[t] = 0;
  }
  const tape: PublicView["tape"] = [];
  for (let i = m.trades.length - 1; i >= 0; i--) {
    const t = m.trades[i];
    if (t.voided) continue;
    if (tape.length < TAPE_LEN) tape.push({ ticker: t.ticker, price: t.price, qty: t.qty, time: Math.floor(t.ts / 1000) * 1000 });
    if (perStock[t.ticker].length < PRICES_PER_STOCK) perStock[t.ticker].push(t.price);
    if (t.round === m.round) {
      vol[t.ticker] += t.qty;
      hi[t.ticker] = Math.max(hi[t.ticker] ?? 0, t.price);
      lo[t.ticker] = Math.min(lo[t.ticker] ?? Infinity, t.price);
    }
    if (tape.length >= TAPE_LEN && t.round < m.round && Object.values(perStock).every((a) => a.length >= PRICES_PER_STOCK)) break;
  }
  const prev = m.rvHistory.length >= 2 ? m.rvHistory[m.rvHistory.length - 2] : m.rvHistory[0];
  const stocks = m.scenario.stocks.map((s) => {
    const book = m.books.get(s.ticker)!;
    return {
      ticker: s.ticker,
      name: s.name,
      sector: s.sector,
      description: s.description,
      volatility: s.volatility,
      links: s.links,
      startPrice: Math.round(s.startPrice * 100),
      rv: m.rv[s.ticker],
      rvPrev: prev[s.ticker],
      lastPrice: m.lastPrice[s.ticker],
      bids: book.levels("BUY", BOOK_DEPTH),
      asks: book.levels("SELL", BOOK_DEPTH),
      roundVolume: vol[s.ticker],
      roundHigh: hi[s.ticker] ?? null,
      roundLow: lo[s.ticker] ?? null,
      history: m.rvHistory.map((h) => h[s.ticker]),
      recentPrices: perStock[s.ticker].reverse(),
    };
  });
  const news: PublicView["news"] = [];
  const released = m.phase === "LOBBY" ? 0 : m.round;
  for (let r = 1; r <= released; r++) for (const n of m.scenario.rounds[r - 1].news) news.push({ round: r, ...n });
  news.reverse();

  const fr = m.openForecastRound() ?? (m.phase === "TRADING" && m.currentRound?.forecast ? m.round : null);
  const forecastDef = fr ? m.scenario.rounds[fr - 1].forecast! : null;
  const inRound = m.phase === "NEWS" || m.phase === "TRADING";
  const p = m.params;
  return {
    serverTime: now,
    name: m.scenario.meta.name,
    phase: m.phase,
    round: m.round,
    totalRounds: p.rounds,
    roundTitle: m.currentRound?.title ?? null,
    phaseEndsAt: m.phaseEndsAt,
    paused: m.paused,
    pausedRemainingMs: m.pausedRemainingMs,
    stocks,
    tape,
    news,
    forecast: forecastDef && fr ? { round: fr, ticker: forecastDef.ticker, question: forecastDef.question } : null,
    research: inRound ? (m.currentRound?.research ?? []).map((r) => ({ id: r.id, title: r.title, cost: 1 })) : [],
    roundResults: m.summaries.map((s) => ({
      round: s.round,
      rvEnd: s.rvEnd,
      rvStart: s.rvStart,
      top: s.leaderboard.slice(0, 5).map((r) => ({ rank: r.rank, teamName: r.teamName, equity: r.equity, returnPct: r.returnPct })),
    })),
    finalLeaderboard: m.phase === "FINISHED" ? rankTeams(m.teams, m.accounts, m.rv, p.startingCapital * 100) : null,
    finishedReason: m.finishedReason,
    debrief: m.debriefRevealed ? debrief(m) : null,
    rules: {
      startingCapital: p.startingCapital,
      maxOrderNotional: p.maxOrderNotional,
      maxOpenOrders: p.maxOpenOrders,
      marketOrderCollarPct: p.marketOrderCollarPct,
      limitPriceBandPct: p.limitPriceBandPct,
      maxShares: m.maxShares,
      newsSeconds: p.newsSeconds,
      tradingSeconds: p.tradingSeconds,
      settleSeconds: p.settleSeconds,
    },
  };
}

function debrief(m: Market) {
  return {
    rounds: m.scenario.rounds.map((r) => ({
      round: r.round,
      title: r.title,
      hiddenState: r.hiddenState,
      fundamentals: r.fundamentals,
      signals: r.signals.map((s) => ({ ticker: s.ticker, text: s.text, reliability: s.reliability, truth: s.truth, source: m.scenario.sources[s.source].label })),
    })),
  };
}

export function teamView(m: Market, teamId: string) {
  const team = m.teamById.get(teamId)!;
  const acc = m.accounts.get(teamId)!;
  const snap = m.equityOf(teamId);
  const positions = m.tickers.map((t) => {
    const p = acc.positions[t];
    return {
      ticker: t,
      shares: p.shares,
      reservedShares: acc.reservedShares[t],
      avgCost: Math.round(p.avgCost),
      realized: Math.round(p.realized),
      value: p.shares * m.rv[t],
      unrealized: Math.round(p.shares * (m.rv[t] - p.avgCost)),
      maxShares: m.maxShares[t],
    };
  });
  const openOrders = [...(m.openByTeam.get(teamId) ?? [])]
    .map((id) => m.orders.get(id)!)
    .sort((a, b) => b.ts - a.ts)
    .map((o) => ({ id: o.id, ticker: o.ticker, side: o.side, type: o.type, price: o.price, qty: o.qty, remaining: o.remaining, filled: o.filled, status: o.status, ts: o.ts }));
  const fills = [];
  for (let i = m.trades.length - 1; i >= 0 && fills.length < 40; i--) {
    const t = m.trades[i];
    if (t.voided) continue;
    if (t.buyTeamId === teamId) fills.push({ ticker: t.ticker, side: "BUY", price: t.price, qty: t.qty, ts: t.ts, round: t.round });
    else if (t.sellTeamId === teamId) fills.push({ ticker: t.ticker, side: "SELL", price: t.price, qty: t.qty, ts: t.ts, round: t.round });
  }
  const released = m.phase === "LOBBY" ? 0 : m.round;
  const signals = [];
  for (let r = released; r >= 1; r--) {
    for (const s of m.scenario.rounds[r - 1].signals) {
      if (s.groups.includes(team.group)) {
        const src = m.scenario.sources[s.source];
        signals.push({ round: r, ticker: s.ticker, text: s.text, source: src.label, statedReliability: src.statedReliability });
      }
    }
  }
  const research = acc.research.map((id) => {
    for (const r of m.scenario.rounds) {
      const item = r.research.find((x) => x.id === id);
      if (item) return { id, round: r.round, title: item.title, result: item.result };
    }
    return { id, round: 0, title: id, result: "" };
  });
  const last = m.summaries[m.summaries.length - 1];
  const rank = last ? last.leaderboard.find((r) => r.teamId === teamId)?.rank ?? null : null;
  const finalRank = m.phase === "FINISHED" ? rankTeams(m.teams, m.accounts, m.rv, m.params.startingCapital * 100).find((r) => r.teamId === teamId)?.rank ?? null : null;
  const capital = m.params.startingCapital * 100;
  return {
    team: { id: team.id, name: team.name, number: team.number },
    teamsTotal: m.teams.length,
    startingCapital: capital,
    cash: acc.cash,
    reservedCash: acc.reservedCash,
    availableCash: acc.cash - acc.reservedCash,
    equity: snap.equity,
    holdingsValue: snap.holdingsValue,
    realized: snap.realized,
    unrealized: snap.unrealized,
    returnPct: Math.round(((snap.equity - capital) / capital) * 10000) / 100,
    rank: finalRank ?? rank,
    positions,
    openOrders,
    fills,
    signals,
    researchCredits: acc.researchCredits,
    research,
    forecasts: acc.forecasts as Record<number, Direction>,
    forecastScore: acc.forecastScore,
    history: acc.snapshots,
    maxDrawdownPct: acc.maxDrawdownPct,
  };
}

export type TeamView = ReturnType<typeof teamView>;

export function adminView(m: Market, now: number) {
  const capital = m.params.startingCapital * 100;
  const live = rankTeams(m.teams, m.accounts, m.rv, capital);
  const openOrders = [];
  for (const book of m.books.values()) {
    for (const o of book.all()) {
      openOrders.push({ ticker: o.ticker, side: o.side, price: o.price, remaining: o.remaining, team: o.teamId === MM_ID ? "Market maker" : m.teamById.get(o.teamId)?.name ?? o.teamId, ts: o.ts });
    }
  }
  const nameOf = (id: string) => (id === MM_ID ? "MM" : m.teamById.get(id)?.name ?? id);
  const recentTrades = m.trades.slice(-80).reverse().map((t) => ({ ...t, buyer: nameOf(t.buyTeamId), seller: nameOf(t.sellTeamId) }));
  const next = m.currentRound;
  return {
    serverTime: now,
    phase: m.phase,
    round: m.round,
    paused: m.paused,
    phaseEndsAt: m.phaseEndsAt,
    pausedRemainingMs: m.pausedRemainingMs,
    teams: m.teams.map((t) => ({ ...t, ...pick(live.find((r) => r.teamId === t.id)!), openOrders: m.openByTeam.get(t.id)?.size ?? 0, researchCredits: m.accounts.get(t.id)!.researchCredits })),
    leaderboard: live,
    stocks: m.tickers.map((t) => ({
      ticker: t,
      rv: m.rv[t],
      rvStart: m.rvStart[t],
      fundamental: Math.round(m.fundamental[t]),
      roundMove: next?.fundamentals[t] ?? null,
      lastPrice: m.lastPrice[t],
      mmMid: Math.round(m.mmMid(t)),
      mmNet: m.mmNet[t],
    })),
    openOrders: openOrders.slice(0, 200),
    recentTrades,
    tradeCount: m.trades.filter((t) => !t.voided).length,
    summaries: m.summaries,
    audit: m.audit.slice(-150).reverse(),
    round_: next ? { title: next.title, purpose: next.purpose, hiddenState: next.hiddenState, signals: next.signals } : null,
  };
}

function pick(r: LeaderboardRow) {
  return { rank: r.rank, equity: r.equity, returnPct: r.returnPct, realized: r.realized, cash: r.cash, maxDrawdownPct: r.maxDrawdownPct, forecastScore: r.forecastScore };
}
