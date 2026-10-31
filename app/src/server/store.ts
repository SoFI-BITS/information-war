import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { Command, EngineEvent, Scenario } from "../engine/types";

/**
 * Persistence. The ordered command log is the source of truth (replayed on
 * startup); projections are derived tables for exports and audits.
 *
 * - FileStore: zero-setup. data/<competition>/commands.jsonl, appended synchronously
 *   before the client is acknowledged.
 * - PrismaStore: PostgreSQL. Commands and projections are written through a
 *   single ordered queue so the database sees them in engine order.
 */
export interface Store {
  readonly kind: "file" | "postgres";
  open(competitionId: string, scenario: Scenario, scenarioHash: string): Promise<void>;
  loadCommands(): Promise<Command[]>;
  append(cmd: Command): void;
  project(events: EngineEvent[]): void;
  loadSessions(): Promise<Record<string, string>>;
  setSession(teamId: string, token: string | null): void;
  pending(): number;
  lastError(): string | null;
  flush(): Promise<void>;
}

const DATA_DIR = path.resolve(process.cwd(), "data");

export function currentCompetitionId(): string {
  const f = path.join(DATA_DIR, "current.json");
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8")).id;
  return setCurrentCompetitionId(`comp-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`);
}

/**
 * Hosts like Render and Railway wipe data/ on every deploy. With Postgres and no
 * local pointer, resume the newest competition in the database instead of starting a new one.
 */
export async function startupCompetitionId(): Promise<string> {
  if (process.env.DATABASE_URL && !existsSync(path.join(DATA_DIR, "current.json"))) {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    try {
      const row = await db.competition.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } });
      if (row) return setCurrentCompetitionId(row.id);
    } finally {
      await db.$disconnect();
    }
  }
  return currentCompetitionId();
}

export function setCurrentCompetitionId(id: string) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(path.join(DATA_DIR, "current.json"), JSON.stringify({ id }));
  return id;
}

export class FileStore implements Store {
  readonly kind = "file" as const;
  private dir = "";

  async open(competitionId: string, scenario: Scenario, scenarioHash: string) {
    this.dir = path.join(DATA_DIR, competitionId);
    mkdirSync(this.dir, { recursive: true });
    const meta = path.join(this.dir, "competition.json");
    if (!existsSync(meta)) writeFileSync(meta, JSON.stringify({ id: competitionId, name: scenario.meta.name, version: scenario.meta.version, scenarioHash, createdAt: new Date().toISOString() }, null, 2));
  }

  async loadCommands(): Promise<Command[]> {
    const f = path.join(this.dir, "commands.jsonl");
    if (!existsSync(f)) return [];
    return readFileSync(f, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  append(cmd: Command) {
    appendFileSync(path.join(this.dir, "commands.jsonl"), JSON.stringify(cmd) + "\n");
  }

  project() {
    // The command log already contains everything; exports are computed from the engine.
  }

  async loadSessions() {
    const f = path.join(this.dir, "sessions.json");
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, string>) : {};
  }

  setSession(teamId: string, token: string | null) {
    const f = path.join(this.dir, "sessions.json");
    const s = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
    if (token) s[teamId] = token;
    else delete s[teamId];
    writeFileSync(f, JSON.stringify(s));
  }

  pending() {
    return 0;
  }
  lastError() {
    return null;
  }
  async flush() {}
}

export class PrismaStore implements Store {
  readonly kind = "postgres" as const;
  private db!: PrismaClient;
  private comp = "";
  private seq = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private error: string | null = null;

  private enqueue(fn: () => Promise<unknown>) {
    this.queued++;
    this.queue = this.queue
      .then(fn)
      .catch((e) => {
        this.error = `${new Date().toISOString()} ${String(e?.message ?? e).slice(0, 300)}`;
        console.error("[store]", e);
      })
      .finally(() => this.queued--);
  }

  async open(competitionId: string, scenario: Scenario, scenarioHash: string) {
    const { PrismaClient } = await import("@prisma/client");
    this.db = new PrismaClient();
    this.comp = competitionId;
    const db = this.db;
    const existing = await db.competition.findUnique({ where: { id: competitionId } });
    if (!existing) {
      await db.$transaction([
        db.competition.create({ data: { id: competitionId, name: scenario.meta.name, scenarioVersion: scenario.meta.version, scenarioHash, config: scenario.params as object } }),
        db.stock.createMany({ data: scenario.stocks.map((s) => ({ competitionId, ticker: s.ticker, name: s.name, sector: s.sector, description: s.description, startPriceCents: Math.round(s.startPrice * 100), volatility: s.volatility })) }),
        db.round.createMany({ data: scenario.rounds.map((r) => ({ competitionId, number: r.round, title: r.title, purpose: r.purpose, hiddenState: r.hiddenState, fundamentals: r.fundamentals })) }),
        db.publicNewsItem.createMany({ data: scenario.rounds.flatMap((r) => r.news.map((n) => ({ competitionId, roundNumber: r.round, headline: n.headline, body: n.body }))) }),
        db.privateSignal.createMany({
          data: scenario.rounds.flatMap((r) =>
            r.signals.map((s) => ({ competitionId, signalKey: s.id, roundNumber: r.round, ticker: s.ticker, text: s.text, source: scenario.sources[s.source].label, reliability: s.reliability, impliedDirection: s.impliedDirection, targetRound: s.targetRound, groups: s.groups, truth: s.truth })),
          ),
        }),
      ]);
    }
    const last = await db.engineCommand.findFirst({ where: { competitionId }, orderBy: { seq: "desc" } });
    this.seq = last?.seq ?? 0;
  }

  async loadCommands(): Promise<Command[]> {
    const rows = await this.db.engineCommand.findMany({ where: { competitionId: this.comp }, orderBy: { seq: "asc" } });
    return rows.map((r) => r.payload as unknown as Command);
  }

  append(cmd: Command) {
    const seq = ++this.seq;
    this.enqueue(() => this.db.engineCommand.create({ data: { competitionId: this.comp, seq, type: cmd.type, payload: cmd as object, ts: new Date(cmd.ts) } }));
  }

  project(events: EngineEvent[]) {
    if (events.length === 0) return;
    this.enqueue(() => this.write(events));
  }

  private async write(events: EngineEvent[]) {
    const db = this.db;
    const competitionId = this.comp;
    for (const ev of events) {
      switch (ev.kind) {
        case "TEAMS":
          await db.team.deleteMany({ where: { competitionId } });
          await db.team.createMany({ data: ev.teams.map((t) => ({ id: t.id, competitionId, number: t.number, name: t.name, code: t.code, group: t.group })) });
          break;
        case "ROUND_STARTED":
          await db.round.update({ where: { competitionId_number: { competitionId, number: ev.round } }, data: { startedAt: new Date(ev.ts), settledAt: null } });
          if (ev.round === 1) await db.competition.update({ where: { id: competitionId }, data: { status: "RUNNING", startedAt: new Date(ev.ts) } });
          await db.marketEvent.create({ data: { competitionId, roundNumber: ev.round, kind: "ROUND_STARTED", data: {}, createdAt: new Date(ev.ts) } });
          break;
        case "ORDER": {
          const o = ev.order;
          const data = { teamId: o.teamId, ticker: o.ticker, roundNumber: o.round, side: o.side, type: o.type, priceCents: o.price, qty: o.qty, remaining: o.remaining, filled: o.filled, status: o.status, seq: o.seq, clientOrderId: o.clientOrderId ?? null, submittedAt: new Date(o.ts) };
          await db.order.upsert({ where: { id: o.id }, create: { id: o.id, competitionId, ...data }, update: data });
          break;
        }
        case "TRADE": {
          const t = ev.trade;
          await db.tradeExecution.create({
            data: { competitionId, id: t.id, seq: t.seq, roundNumber: t.round, ticker: t.ticker, priceCents: t.price, qty: t.qty, buyTeamId: t.buyTeamId, sellTeamId: t.sellTeamId, buyOrderId: t.buyOrderId, sellOrderId: t.sellOrderId, aggressor: t.aggressor, executedAt: new Date(t.ts) },
          });
          break;
        }
        case "ROUND_SETTLED": {
          const { summary: s, snapshots, positions } = ev;
          const now = new Date();
          const rankOf = new Map(s.leaderboard.map((r) => [r.teamId, r.rank]));
          await db.$transaction([
            db.round.update({ where: { competitionId_number: { competitionId, number: s.round } }, data: { settledAt: now } }),
            db.portfolioSnapshot.deleteMany({ where: { competitionId, roundNumber: s.round } }),
            db.portfolioSnapshot.createMany({
              data: Object.entries(snapshots).map(([teamId, sn]) => ({ competitionId, teamId, roundNumber: s.round, cashCents: sn.cash, holdingsValueCents: sn.holdingsValue, equityCents: sn.equity, realizedCents: sn.realized, unrealizedCents: sn.unrealized, rank: rankOf.get(teamId) ?? 0 })),
            }),
            db.holding.deleteMany({ where: { competitionId } }),
            db.holding.createMany({
              data: Object.entries(positions).flatMap(([teamId, pos]) =>
                Object.entries(pos).map(([ticker, p]) => ({ competitionId, teamId, ticker, shares: p.shares, avgCostCents: p.avgCost, realizedCents: p.realized, asOfRound: s.round })),
              ),
            }),
            db.marketEvent.createMany({
              data: Object.keys(s.rvEnd).map((ticker) => ({ competitionId, roundNumber: s.round, ticker, kind: "REFERENCE_VALUE", data: { rvStart: s.rvStart[ticker], rvEnd: s.rvEnd[ticker], vwap: s.vwap[ticker], volume: s.volume[ticker] }, createdAt: now })),
            }),
          ]);
          break;
        }
        case "ROUND_VOIDED":
          await db.$transaction([
            db.tradeExecution.updateMany({ where: { competitionId, roundNumber: ev.round }, data: { voided: true } }),
            db.portfolioSnapshot.deleteMany({ where: { competitionId, roundNumber: ev.round } }),
            db.round.update({ where: { competitionId_number: { competitionId, number: ev.round } }, data: { voidedCount: { increment: 1 }, settledAt: null } }),
            db.marketEvent.create({ data: { competitionId, roundNumber: ev.round, kind: "ROUND_VOIDED", data: {}, createdAt: new Date(ev.ts) } }),
          ]);
          break;
        case "RESEARCH":
          await db.researchAction.create({ data: { competitionId, teamId: ev.teamId, researchKey: ev.researchId, roundNumber: ev.round, createdAt: new Date(ev.ts) } });
          break;
        case "FORECAST":
          await db.forecast.upsert({
            where: { competitionId_teamId_roundNumber: { competitionId, teamId: ev.teamId, roundNumber: ev.round } },
            create: { competitionId, teamId: ev.teamId, roundNumber: ev.round, ticker: ev.ticker, direction: ev.direction, updatedAt: new Date(ev.ts) },
            update: { direction: ev.direction, updatedAt: new Date(ev.ts) },
          });
          break;
        case "AUDIT":
          await db.auditLog.create({ data: { competitionId, seq: ev.entry.seq, actor: ev.entry.actor, action: ev.entry.action, detail: ev.entry.detail, createdAt: new Date(ev.entry.ts) } });
          if (ev.entry.action === "FINISHED") await db.competition.update({ where: { id: competitionId }, data: { status: "FINISHED", finishedAt: new Date(ev.entry.ts) } });
          break;
      }
    }
  }

  async loadSessions() {
    const teams = await this.db.team.findMany({ where: { competitionId: this.comp, sessionToken: { not: null } } });
    return Object.fromEntries(teams.map((t) => [t.id, t.sessionToken!]));
  }

  setSession(teamId: string, token: string | null) {
    this.enqueue(() => this.db.team.updateMany({ where: { id: teamId, competitionId: this.comp }, data: { sessionToken: token } }));
  }

  pending() {
    return this.queued;
  }
  lastError() {
    return this.error;
  }
  async flush() {
    await this.queue;
  }
}
