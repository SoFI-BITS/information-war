/**
 * PostgreSQL integration check: runs a short session through Market + PrismaStore,
 * then verifies the projections and that replaying the stored command log
 * reproduces the same state.   DATABASE_URL=... npx tsx src/sim/pgcheck.ts
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Market } from "../engine/market";
import type { Command, Side } from "../engine/types";
import { loadScenario } from "../scenario/load";
import { PrismaStore } from "../server/store";

async function main() {
  const scn = loadScenario();
  const comp = `pgcheck-${Date.now()}`;
  const store = new PrismaStore();
  await store.open(comp, scn, "test-hash");
  const m = new Market(scn);
  let ts = Date.now();
  const exec = (c: Record<string, unknown>) => {
    const cmd = { ts: (ts += 50), ...c } as Command;
    const r = m.apply(cmd);
    if (r.ok && !r.duplicate) store.append(cmd);
    store.project(m.drain());
    return r;
  };
  exec({ type: "SETUP_TEAMS", teams: Array.from({ length: 6 }, (_, i) => ({ id: `${comp}-t${i + 1}`, number: i + 1, name: `T${i + 1}`, code: `${comp.slice(-6)}${i}` })) });
  exec({ type: "START" });
  for (let round = 1; round <= 3; round++) {
    exec({ type: "ADVANCE" });
    if (round === 1) exec({ type: "BUY_RESEARCH", teamId: `${comp}-t1`, researchId: "R1-1" });
    for (let i = 0; i < 80; i++) {
      const t = m.tickers[i % 10];
      exec({ type: "PLACE_ORDER", teamId: `${comp}-t${1 + (i % 6)}`, orderId: randomUUID(), ticker: t, side: (i % 3 ? "BUY" : "SELL") as Side, orderType: i % 4 ? "LIMIT" : "MARKET", price: Math.round(m.rvStart[t] * (0.99 + (i % 5) * 0.005)), qty: 1 + (i % 15) });
    }
    if (round === 2) {
      exec({ type: "RESTART_ROUND", reason: "pg check" });
      exec({ type: "ADVANCE" });
    }
    exec({ type: "ADVANCE" });
    exec({ type: "ADVANCE" });
  }
  await store.flush();
  if (store.lastError()) throw new Error(`store error: ${store.lastError()}`);

  const db = new PrismaClient();
  const counts = {
    commands: await db.engineCommand.count({ where: { competitionId: comp } }),
    teams: await db.team.count({ where: { competitionId: comp } }),
    orders: await db.order.count({ where: { competitionId: comp } }),
    trades: await db.tradeExecution.count({ where: { competitionId: comp } }),
    voidedTrades: await db.tradeExecution.count({ where: { competitionId: comp, voided: true } }),
    snapshots: await db.portfolioSnapshot.count({ where: { competitionId: comp } }),
    holdings: await db.holding.count({ where: { competitionId: comp } }),
    refValues: await db.marketEvent.count({ where: { competitionId: comp, kind: "REFERENCE_VALUE" } }),
    research: await db.researchAction.count({ where: { competitionId: comp } }),
    audit: await db.auditLog.count({ where: { competitionId: comp } }),
    signals: await db.privateSignal.count({ where: { competitionId: comp } }),
  };
  console.log(counts);
  const trades = m.trades.length;
  const replay = new Market(scn);
  for (const c of await store.loadCommands()) replay.apply(c);
  const same = replay.fingerprint() === m.fingerprint();
  const ok = same && counts.trades === trades && counts.snapshots === 6 * 3 && counts.teams === 6 && counts.voidedTrades > 0 && counts.refValues >= 30;
  console.log(`replay identical: ${same}; trades engine=${trades} db=${counts.trades}; ${ok ? "PASS" : "FAIL"}`);
  await db.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
