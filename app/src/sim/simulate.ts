/**
 * Calibration simulator (design doc §14). Runs full 10-round competitions with
 * automated teams using different strategies and reports whether any strategy
 * or mechanical trick dominates.
 *
 *   npm run simulate -- [runs=20] [teams=25]
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Market } from "../engine/market";
import type { Command, Side } from "../engine/types";
import { loadScenario } from "../scenario/load";

const RUNS = Number(process.argv[2] ?? 20);
const TEAMS = Number(process.argv[3] ?? 25);
const SCN = loadScenario();

type Strategy = "fundamental" | "intelOnly" | "momentum" | "contrarian" | "random" | "riskAverse" | "concentrated" | "flowFollower" | "pumpAndDump";
const STRATEGIES: Strategy[] = ["fundamental", "intelOnly", "momentum", "contrarian", "random", "riskAverse", "concentrated", "flowFollower", "pumpAndDump"];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const gauss = () => Math.sqrt(-2 * Math.log(next() + 1e-12)) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

interface Bot {
  id: string;
  strategy: Strategy;
  beliefs: Record<string, number>;
}

function runOnce(seed: number) {
  const r = rng(seed);
  const m = new Market(SCN);
  let ts = 1_700_000_000_000;
  const run = (c: Record<string, unknown>) => m.apply({ ts, ...c } as Command);
  const bots: Bot[] = Array.from({ length: TEAMS }, (_, i) => ({ id: `t${i + 1}`, strategy: STRATEGIES[i % STRATEGIES.length], beliefs: {} }));
  run({ type: "SETUP_TEAMS", teams: bots.map((b, i) => ({ id: b.id, number: i + 1, name: `${b.strategy}-${i + 1}`, code: `C${i}` })) });
  run({ type: "START" });

  let marketOrders = 0;
  let slippageSum = 0;

  const send = (bot: Bot, ticker: string, side: Side, qty: number, market: boolean) => {
    if (qty < 1) return;
    const book = m.books.get(ticker)!;
    const best = book.best(side === "BUY" ? "SELL" : "BUY");
    const acc = m.accounts.get(bot.id)!;
    if (side === "SELL") qty = Math.min(qty, acc.positions[ticker].shares - acc.reservedShares[ticker]);
    if (side === "BUY") {
      const room = m.maxShares[ticker] - acc.positions[ticker].shares;
      qty = Math.min(qty, room, Math.floor((m.params.maxOrderNotional * 100) / (m.rvStart[ticker] * 1.06)));
    }
    if (qty < 1) return;
    const ref = best?.price ?? m.rvStart[ticker];
    const price = Math.round(side === "BUY" ? ref * 1.002 : ref * 0.998);
    const res = run({ type: "PLACE_ORDER", teamId: bot.id, orderId: randomUUID(), ticker, side, orderType: market ? "MARKET" : "LIMIT", price, qty });
    if (market && res.ok) {
      const d = res.data as { avgPrice: number | null };
      if (d.avgPrice && best) {
        marketOrders++;
        slippageSum += Math.abs(d.avgPrice - best.price) / best.price;
      }
    }
  };

  const act = (bot: Bot, tradingSecond: number) => {
    const round = m.currentRound!;
    const tickers = m.tickers;
    const lastMove = (t: string) => (m.rvHistory.length >= 2 ? m.rv[t] / m.rvHistory[m.rvHistory.length - 2][t] - 1 : 0);
    const size = (pct: number) => Math.floor((12_000 * pct * 100) / 10_000);
    switch (bot.strategy) {
      case "fundamental":
      case "riskAverse":
      case "concentrated": {
        const sorted = [...tickers].sort((a, b) => bot.beliefs[b] - bot.beliefs[a]);
        const thr = bot.strategy === "riskAverse" ? 5 : 2;
        const picks = bot.strategy === "concentrated" ? 1 : 2;
        for (const t of sorted.slice(0, picks)) if (bot.beliefs[t] > thr) send(bot, t, "BUY", Math.round((size(bot.strategy === "riskAverse" ? 0.3 : 1) * 100) / m.rvStart[t]), r.next() < 0.4);
        for (const t of sorted.slice(-picks)) if (bot.beliefs[t] < -thr) send(bot, t, "SELL", 40, r.next() < 0.4);
        break;
      }
      case "intelOnly": {
        const team = m.teamById.get(bot.id)!;
        const sig = round.signals.find((s) => s.groups.includes(team.group))!;
        send(bot, sig.ticker, sig.impliedDirection > 0 ? "BUY" : "SELL", Math.round(10_000_00 / m.rvStart[sig.ticker]), r.next() < 0.5);
        break;
      }
      case "momentum":
      case "contrarian": {
        const sign = bot.strategy === "momentum" ? 1 : -1;
        const t = tickers[Math.floor(r.next() * tickers.length)];
        const mv = lastMove(t) * sign;
        if (Math.abs(mv) > 0.01) send(bot, t, mv > 0 ? "BUY" : "SELL", Math.round(600_000 / m.rvStart[t]), r.next() < 0.5);
        break;
      }
      case "random": {
        const t = tickers[Math.floor(r.next() * tickers.length)];
        send(bot, t, r.next() < 0.5 ? "BUY" : "SELL", 1 + Math.floor(r.next() * 40), r.next() < 0.5);
        break;
      }
      case "flowFollower": {
        const t = tickers[Math.floor(r.next() * tickers.length)];
        const lp = m.lastPrice[t];
        if (lp && lp > m.rvStart[t] * 1.005) send(bot, t, "BUY", Math.round(600_000 / m.rvStart[t]), true);
        else if (lp && lp < m.rvStart[t] * 0.995) send(bot, t, "SELL", Math.round(600_000 / m.rvStart[t]), true);
        break;
      }
      case "pumpAndDump": {
        // Mechanical exploit probe: buy hard early to push quotes, dump late.
        const t = "MRLW";
        if (tradingSecond < 100) send(bot, t, "BUY", 150, true);
        else send(bot, t, "SELL", 150, true);
        break;
      }
    }
  };

  for (let round = 1; round <= SCN.params.rounds; round++) {
    // News phase: bots form beliefs. Fundamental analysts read public news imperfectly.
    for (const b of bots) {
      for (const t of m.tickers) b.beliefs[t] = SCN.rounds[round - 1].fundamentals[t] + r.gauss() * 7;
    }
    ts += SCN.params.newsSeconds * 1000;
    run({ type: "ADVANCE", actor: "clock" });
    for (let s = 0; s < SCN.params.tradingSeconds; s += 2) {
      ts += 2000;
      for (const b of bots) if (r.next() < 0.12) act(b, s);
    }
    run({ type: "ADVANCE", actor: "clock" });
    ts += SCN.params.settleSeconds * 1000;
    run({ type: "ADVANCE", actor: "clock" });
  }
  const board = m.summaries[m.summaries.length - 1].leaderboard;
  const byStrategy: Record<string, number[]> = {};
  for (const row of board) {
    const strat = bots.find((b) => b.id === row.teamId)!.strategy;
    (byStrategy[strat] ??= []).push(row.returnPct);
  }
  const volumeByTicker: Record<string, number> = {};
  const teamTradeShare = m.trades.filter((t) => t.buyTeamId !== "__MM__" && t.sellTeamId !== "__MM__").length / Math.max(1, m.trades.length);
  for (const t of m.trades) volumeByTicker[t.ticker] = (volumeByTicker[t.ticker] ?? 0) + t.qty * t.price;
  const winner = bots.find((b) => b.id === board[0].teamId)!.strategy;
  return { byStrategy, winner, trades: m.trades.length, marketOrders, avgSlippagePct: marketOrders ? (slippageSum / marketOrders) * 100 : 0, volumeByTicker, teamTradeShare, simulatedMinutes: (ts - 1_700_000_000_000) / 60000 };
}

const results = Array.from({ length: RUNS }, (_, i) => runOnce(1000 + i));
const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const lines: string[] = [];
const out = (s = "") => {
  lines.push(s);
  console.log(s);
};
out(`# Calibration report`);
out();
out(`${RUNS} simulated competitions × ${TEAMS} bot teams (${STRATEGIES.length} strategies, round-robin). Generated by \`npm run simulate\`.`);
out();
out(`| Strategy | Avg return | Best | Worst | Wins |`);
out(`|---|---:|---:|---:|---:|`);
for (const s of STRATEGIES) {
  const all = results.flatMap((r) => r.byStrategy[s] ?? []);
  const wins = results.filter((r) => r.winner === s).length;
  out(`| ${s} | ${avg(all).toFixed(2)}% | ${Math.max(...all).toFixed(2)}% | ${Math.min(...all).toFixed(2)}% | ${wins}/${RUNS} |`);
}
out();
out(`- Average trades per event: ${avg(results.map((r) => r.trades)).toFixed(0)} (team-vs-team share ${(avg(results.map((r) => r.teamTradeShare)) * 100).toFixed(0)}%)`);
out(`- Average market-order slippage vs best price at submission: ${avg(results.map((r) => r.avgSlippagePct)).toFixed(2)}%`);
out(`- Simulated event length: ${results[0].simulatedMinutes.toFixed(1)} minutes of rounds (plus briefing and results)`);
out();
out(`Traded value share by stock (checks that no single stock dominates; MRLW is inflated because the pumpAndDump probe trades only MRLW):`);
out();
const tot: Record<string, number> = {};
for (const r of results) for (const [t, v] of Object.entries(r.volumeByTicker)) tot[t] = (tot[t] ?? 0) + v;
const sum = Object.values(tot).reduce((a, b) => a + b, 0);
out(`| Ticker | Share |`);
out(`|---|---:|`);
for (const t of SCN.stocks.map((s) => s.ticker)) out(`| ${t} | ${(((tot[t] ?? 0) / sum) * 100).toFixed(1)}% |`);
out();
out(`Interpretation guide: no strategy should win every run; "intelOnly" should not dominate (private info useful but not decisive);`);
out(`"pumpAndDump" (mechanical manipulation probe) should lose money; random trading should underperform informed trading.`);

const dir = path.resolve(__dirname, "../../../docs/phase-4-engine");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "calibration-report.md"), lines.join("\n") + "\n");
