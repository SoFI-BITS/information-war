import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { loadScenario } from "../scenario/load";
import { Market } from "./market";
import type { Command, EventOptions, Scenario, Side } from "./types";
import { rankTeams, referenceValue } from "./valuation";
import { publicView } from "./views";

const BASE = loadScenario();

function scenario({ mm = false } = {}): Scenario {
  const s = structuredClone(BASE);
  if (!mm) {
    s.params.marketMaker.levels = 0;
    for (const r of s.rounds) delete r.marketMaker;
  }
  return s;
}

/** Market with n teams, already in round 1 TRADING. */
function setup(n = 6, opts: { mm?: boolean; options?: EventOptions } = {}) {
  const m = new Market(scenario(opts));
  let ts = 1_000_000;
  const log: Command[] = [];
  const run = (c: Record<string, unknown>) => {
    const cmd = { ts: (ts += 100), ...c } as Command;
    const res = m.apply(cmd);
    if (res.ok && !res.duplicate) log.push(cmd);
    return res;
  };
  run({ type: "SETUP_TEAMS", teams: Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, number: i + 1, name: `Team ${i + 1}`, code: `CODE${i + 1}` })), options: opts.options });
  run({ type: "START" });
  if (m.phase === "BRIEFING") run({ type: "ADVANCE" });
  run({ type: "ADVANCE" });
  const order = (team: number, side: Side, qty: number, price?: number, extra: Record<string, unknown> = {}) =>
    run({ type: "PLACE_ORDER", teamId: `t${team}`, orderId: randomUUID(), ticker: "NVTX", side, orderType: price ? "LIMIT" : "MARKET", price, qty, ...extra });
  return { m, run, order, log, acc: (t: number) => m.accounts.get(`t${t}`)! };
}

describe("order book matching", () => {
  it("fills by price, then time priority, at the resting price", () => {
    const { m, order, acc } = setup();
    order(1, "SELL", 10, 14200);
    order(2, "SELL", 10, 14200);
    order(3, "SELL", 10, 14150);
    const cash4 = acc(4).cash;
    const res = order(4, "BUY", 25, 14200);
    assert.equal(res.ok, true);
    const fills = m.trades.map((t) => [t.sellTeamId, t.qty, t.price]);
    assert.deepEqual(fills, [["t3", 10, 14150], ["t1", 10, 14200], ["t2", 5, 14200]]);
    assert.equal(acc(4).cash, cash4 - (10 * 14150 + 15 * 14200));
    assert.equal(acc(4).reservedCash, 0);
    assert.equal(acc(2).reservedShares.NVTX, 5);
    assert.equal(m.books.get("NVTX")!.asks[0].remaining, 5);
  });

  it("market orders are IOC within the collar and report partial fills", () => {
    const { order, acc } = setup();
    order(1, "SELL", 5, 14200);
    order(2, "SELL", 5, 15000); // beyond 3% collar of 142.00
    const res = order(3, "BUY", 10);
    assert.equal((res.data as { outcome: string }).outcome, "PARTIALLY_FILLED");
    assert.equal((res.data as { filled: number }).filled, 5);
    assert.equal(acc(3).reservedCash, 0);
  });

  it("market order with no liquidity is unfilled and changes nothing", () => {
    const { m, order, acc } = setup();
    const before = JSON.stringify(acc(1));
    const res = order(1, "BUY", 5);
    assert.equal((res.data as { outcome: string }).outcome, "UNFILLED");
    assert.equal(JSON.stringify(acc(1)), before);
    assert.equal(m.trades.length, 0);
  });

  it("prevents self-trades by cancelling the resting order", () => {
    const { m, order, acc } = setup();
    order(1, "SELL", 5, 14200);
    order(1, "BUY", 5, 14200);
    assert.equal(m.trades.length, 0);
    assert.equal(acc(1).reservedShares.NVTX, 0);
    assert.equal(m.books.get("NVTX")!.bids.length, 1);
  });
});

describe("risk checks", () => {
  it("reserves cash and rejects orders beyond available cash", () => {
    const { run, acc } = setup();
    // ~11k each; starting cash is ~60k, so the sixth order must be rejected.
    const orders: [string, number, number][] = [["NVTX", 14000, 78], ["HBFG", 8800, 125], ["PTRL", 7400, 148], ["CLVH", 12600, 87], ["MRLW", 6400, 171], ["FRGE", 9600, 114]];
    const results = orders.map(([ticker, price, qty]) =>
      run({ type: "PLACE_ORDER", teamId: "t1", orderId: randomUUID(), ticker, side: "BUY", orderType: "LIMIT", price, qty }),
    );
    assert.deepEqual(results.slice(0, 5).map((r) => r.ok), [true, true, true, true, true]);
    assert.equal(results[5].ok, false);
    assert.match(results[5].error!, /Insufficient available cash/);
    assert.ok(acc(1).cash - acc(1).reservedCash >= 0);
  });

  it("does not allow short selling, including via multiple open orders", () => {
    const { order, acc } = setup();
    const held = acc(1).positions.NVTX.shares;
    assert.equal(order(1, "SELL", held + 1, 14200).ok, false);
    assert.equal(order(1, "SELL", held, 14200).ok, true);
    assert.equal(order(1, "SELL", 1, 14300).ok, false);
  });

  it("enforces position limits including open buy orders", () => {
    const { m, order, acc } = setup();
    const cap = m.maxShares.NVTX;
    const room = cap - acc(1).positions.NVTX.shares;
    assert.equal(order(1, "BUY", Math.min(room, 80), 14000).ok, true);
    const left = room - Math.min(room, 80);
    assert.equal(order(1, "BUY", left + 1, 14000).ok, false);
  });

  it("enforces the limit-price band and order notional cap", () => {
    const { order } = setup();
    assert.equal(order(1, "BUY", 1, 10000).ok, false); // > 25% below 142
    assert.equal(order(1, "BUY", 180, 14200).ok, false); // 25,560 > 25,000 buy cap
  });

  it("rejects trading outside the trading phase", () => {
    const { run, order } = setup();
    run({ type: "ADVANCE" }); // -> SETTLING
    const r = order(1, "BUY", 1, 14200);
    assert.equal(r.ok, false);
    assert.match(r.error!, /closed/);
  });

  it("treats a repeated clientOrderId as the same order", () => {
    const { m, order } = setup();
    const a = order(1, "BUY", 5, 14000, { clientOrderId: "click-1" });
    const b = order(1, "BUY", 5, 14000, { clientOrderId: "click-1" });
    assert.equal(a.ok, true);
    assert.equal(b.duplicate, true);
    assert.equal(m.books.get("NVTX")!.bids.length, 1);
  });

  it("rate-limits bursts of actions", () => {
    const { order } = setup();
    const results = Array.from({ length: 22 }, () => order(1, "BUY", 1, 14000));
    assert.equal(results.filter((r) => r.ok).length, 20);
  });
});

describe("modify order", () => {
  it("keeps priority on a quantity reduction and loses it on a price change", () => {
    const { m, run, order } = setup();
    const a = order(1, "SELL", 10, 14200).data as { orderId: string };
    order(2, "SELL", 10, 14200);
    run({ type: "MODIFY_ORDER", teamId: "t1", orderId: a.orderId, qty: 6 });
    assert.equal(m.books.get("NVTX")!.asks[0].teamId, "t1");
    run({ type: "MODIFY_ORDER", teamId: "t1", orderId: a.orderId, price: 14300 });
    run({ type: "MODIFY_ORDER", teamId: "t1", orderId: a.orderId, price: 14200 });
    assert.equal(m.books.get("NVTX")!.asks[0].teamId, "t2");
    assert.equal(m.accounts.get("t1")!.reservedShares.NVTX, 6);
  });
});

describe("settlement and valuation", () => {
  it("cancels open orders, releases reservations and marks to reference value", () => {
    const { m, run, order, acc } = setup();
    order(1, "BUY", 10, 14000);
    order(2, "SELL", 3, 14500);
    run({ type: "ADVANCE" });
    assert.equal(acc(1).reservedCash, 0);
    assert.equal(acc(2).reservedShares.NVTX, 0);
    assert.equal(m.books.get("NVTX")!.all().length, 0);
    // No trades: RV equals the scripted fundamental (142 × 1.03).
    assert.equal(m.rv.NVTX, Math.round(14200 * 1.03));
    const snap = acc(1).snapshots[0];
    const expected = acc(1).cash + Object.entries(acc(1).positions).reduce((s, [t, p]) => s + p.shares * m.rv[t], 0);
    assert.equal(snap.equity, expected);
  });

  it("a single small trade at an extreme price cannot move the reference value", () => {
    const { m, run, order } = setup();
    order(1, "SELL", 1, 17700);
    order(2, "BUY", 1, 17700);
    run({ type: "ADVANCE" });
    assert.equal(m.rv.NVTX, Math.round(14200 * 1.03));
  });

  it("heavy trading influence is capped at weight × cap", () => {
    const f = 10000;
    const trades = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, seq: i, round: 1, ticker: "X", price: 15000, qty: 50, ts: 0, buyTeamId: `a${i % 5}`, sellTeamId: `b${i % 5}`, buyOrderId: "", sellOrderId: "", aggressor: "BUY" as const }));
    const r = referenceValue(f, trades, BASE.params.referenceValue);
    assert.equal(r.marketInfluence, true);
    assert.equal(r.rv, Math.round(f * (1 + 0.3 * 0.06)));
  });

  it("ranks by equity with published tie-breakers", () => {
    const { m } = setup(3);
    const [a, b, c] = ["t1", "t2", "t3"].map((id) => m.accounts.get(id)!);
    a.positions.NVTX.realized = 500;
    b.positions.NVTX.realized = 900;
    c.maxDrawdownPct = 0;
    const rows = rankTeams(m.teams, m.accounts, m.rv, 10_000_000);
    assert.deepEqual(rows.map((r) => r.teamId), ["t2", "t1", "t3"]);
  });

  it("scores forecasts separately from equity", () => {
    const { m, run } = setup();
    const until = (round: number, phase: string) => {
      while (!(m.round === round && m.phase === phase)) run({ type: "ADVANCE" });
    };
    until(2, "SETTLING");
    assert.equal(m.openForecastRound(), 3);
    run({ type: "SUBMIT_FORECAST", teamId: "t1", round: 3, direction: "UP" });
    run({ type: "SUBMIT_FORECAST", teamId: "t2", round: 3, direction: "DOWN" });
    until(3, "SETTLING");
    assert.equal(m.accounts.get("t1")!.forecastScore, 1); // SLRD +8% in round 3
    assert.equal(m.accounts.get("t2")!.forecastScore, 0);
  });
});

describe("operations", () => {
  it("restart round restores the round-start state and voids its trades", () => {
    const { m, run, order, acc } = setup();
    const before = JSON.stringify([acc(1), acc(2)]);
    order(1, "SELL", 5, 14200);
    order(2, "BUY", 5, 14200);
    run({ type: "BUY_RESEARCH", teamId: "t1", researchId: "R1-1" });
    run({ type: "RESTART_ROUND", reason: "test" });
    assert.equal(m.phase, "NEWS");
    assert.ok(m.trades.every((t) => t.voided));
    const after = JSON.parse(JSON.stringify([acc(1), acc(2)]));
    const exp = JSON.parse(before);
    exp[0].research = ["R1-1"];
    exp[0].researchCredits -= 1;
    assert.deepEqual(after, exp);
  });

  it("replaying the command log reproduces identical state", () => {
    const { m, run, log } = setup(8, { mm: true });
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let round = 0; round < 10 && m.phase !== "FINISHED"; round++) {
      if (m.phase === "NEWS") run({ type: "ADVANCE" });
      for (let i = 0; i < 60; i++) {
        const team = 1 + Math.floor(rnd() * 8);
        const t = m.tickers[Math.floor(rnd() * m.tickers.length)];
        const side: Side = rnd() < 0.5 ? "BUY" : "SELL";
        const px = Math.round(m.rvStart[t] * (0.97 + rnd() * 0.06));
        run({ type: "PLACE_ORDER", teamId: `t${team}`, orderId: randomUUID(), ticker: t, side, orderType: rnd() < 0.3 ? "MARKET" : "LIMIT", price: px, qty: 1 + Math.floor(rnd() * 30) });
      }
      run({ type: "ADVANCE" });
      run({ type: "ADVANCE" });
    }
    const replay = new Market(scenario({ mm: true }));
    for (const c of log) assert.equal(replay.apply(c).ok, true);
    assert.equal(replay.fingerprint(), m.fingerprint());
    assert.ok(m.trades.length > 50);
  });

  it("public view never exposes team identities", () => {
    const { m, order } = setup(4, { mm: true });
    order(1, "BUY", 10);
    order(2, "SELL", 10, 14400);
    const json = JSON.stringify(publicView(m, Date.now()));
    for (const t of m.teams) {
      assert.ok(!json.includes(`"${t.id}"`), `leaks ${t.id}`);
      assert.ok(!json.includes(t.code), `leaks code ${t.code}`);
    }
    assert.ok(!json.includes("__MM__"));
  });
});

describe("market maker", () => {
  it("quotes around the opening RV and skews with net team buying", () => {
    const { m, order } = setup(4, { mm: true });
    const book = m.books.get("NVTX")!;
    const ask0 = book.best("SELL")!.price;
    const bid0 = book.best("BUY")!.price;
    assert.equal(ask0, Math.round(14200 * 1.01));
    assert.equal(bid0, Math.round(14200 * 0.99));
    order(1, "BUY", 80);
    assert.ok(book.best("SELL")!.price > ask0, "ask rises after buying");
    assert.ok(m.mmNet.NVTX > 0);
  });
});

describe("event options", () => {
  const opts = (o: Partial<EventOptions>): EventOptions => ({ briefingSeconds: 0, startWithHoldings: true, ...o });

  it("runs a timed company briefing before Round 1 with trading closed", () => {
    const m = new Market(scenario());
    m.apply({ ts: 1000, type: "SETUP_TEAMS", teams: [{ id: "t1", number: 1, name: "T1", code: "C1" }], options: opts({ briefingSeconds: 300 }) });
    m.apply({ ts: 2000, type: "START" });
    assert.equal(m.phase, "BRIEFING");
    assert.equal(m.round, 0);
    assert.equal(m.phaseEndsAt, 2000 + 300_000);
    assert.equal(m.isDue(2000 + 299_999), false);
    assert.equal(m.isDue(2000 + 300_000), true);
    const res = m.apply({ ts: 3000, type: "PLACE_ORDER", teamId: "t1", orderId: randomUUID(), ticker: "NVTX", side: "BUY", orderType: "LIMIT", price: 14200, qty: 1 });
    assert.equal(res.ok, false);
    assert.equal(publicView(m, 3000).news.length, 0, "no round news during the briefing");
    assert.equal(m.apply({ ts: 4000, type: "PAUSE" }).ok, true);
    assert.equal(m.apply({ ts: 5000, type: "RESUME" }).ok, true);
    m.apply({ ts: 400_000, type: "ADVANCE" });
    assert.equal(m.phase, "NEWS");
    assert.equal(m.round, 1);
  });

  it("can start every team with zero holdings and all capital in cash", () => {
    const { acc, m } = setup(2, { options: opts({ startWithHoldings: false }) });
    for (const t of m.tickers) assert.equal(acc(1).positions[t].shares, 0);
    assert.equal(acc(1).cash, m.params.startingCapital * 100);
    assert.equal(m.equityOf("t1").equity, m.params.startingCapital * 100);
    assert.equal(acc(1).positions.NVTX.shares - acc(1).reservedShares.NVTX, 0, "nothing to sell");
  });

  it("caps each buy order at 25,000 credits; sells and round totals are unlimited", () => {
    const { m, order, acc } = setup(3);
    assert.equal(m.params.maxBuyOrderNotional, 25000);
    const over = order(1, "BUY", 177, 14200); // 25,134
    assert.equal(over.ok, false);
    assert.match(over.error!, /Buy order value exceeds the 25,000/);
    assert.equal(order(1, "BUY", 176, 14200).ok, true); // 24,992
    // A large holding can be sold in one order worth more than 25,000.
    acc(2).positions.NVTX.shares = 200;
    assert.equal(order(2, "SELL", 200, 14300).ok, true); // 28,600
    // No per-round cap: several near-limit buys in the same round are accepted.
    acc(3).cash += 10_000_000;
    m.maxShares.HBFG = 10_000;
    const buy = (qty: number, price: number) => m.apply({ ts: 2_000_000, type: "PLACE_ORDER", teamId: "t3", orderId: randomUUID(), ticker: "HBFG", side: "BUY", orderType: "LIMIT", price, qty });
    for (let i = 0; i < 3; i++) assert.equal(buy(280, 8800 - i * 10).ok, true); // ~24,600 each
  });

  it("replays to the same state with options recorded in the log", () => {
    const { m, log, order } = setup(3, { options: opts({ startWithHoldings: false, briefingSeconds: 60 }) });
    order(1, "BUY", 20, 14300);
    order(2, "SELL", 5, 14100);
    const copy = new Market(scenario());
    for (const c of log) copy.apply(c);
    assert.equal(copy.fingerprint(), m.fingerprint());
  });
});
