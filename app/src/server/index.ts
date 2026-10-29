/**
 * Trusted market server: Next.js pages + Socket.IO real-time channel + the
 * authoritative engine, in one Node process (single writer, no distributed state).
 *
 *   npm run dev      (development)
 *   npm run build && npm start   (event day)
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import next from "next";
import { Server, type Socket } from "socket.io";
import { Market } from "../engine/market";
import type { Command } from "../engine/types";
import { adminView, publicView, teamView } from "../engine/views";
import { DEFAULT_SCENARIO_PATH, loadScenario } from "../scenario/load";
import { exportCsv } from "./exports";
import { AdminCommand, TeamCommand, toCents } from "./protocol";
import { currentCompetitionId, FileStore, PrismaStore, setCurrentCompetitionId, type Store } from "./store";

loadDotEnv();
const PROD = process.argv.includes("--prod");
const PORT = Number(process.env.PORT ?? 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || (PROD ? "" : "admin");
if (!ADMIN_KEY) throw new Error("ADMIN_KEY must be set in production (.env)");
if (!process.env.ADMIN_KEY) console.warn("[warn] ADMIN_KEY not set; using development key 'admin'");

const scenarioPath = process.env.SCENARIO_PATH || DEFAULT_SCENARIO_PATH;
const scenarioHash = createHash("sha256").update(readFileSync(scenarioPath)).digest("hex");
const scenario = loadScenario(scenarioPath);
const startedAt = Date.now();

// ---------------------------------------------------------------- state
let store: Store;
let market: Market;
let competitionId: string;
const sessions = new Map<string, string>(); // teamId -> token
const tokenToTeam = new Map<string, string>();
const lastSeen = new Map<string, number>();
let commandCount = 0;
let dirty = true;

async function openCompetition(id: string) {
  competitionId = id;
  store = process.env.DATABASE_URL ? new PrismaStore() : new FileStore();
  await store.open(id, scenario, scenarioHash);
  market = new Market(scenario);
  const log = await store.loadCommands();
  for (const cmd of log) {
    const res = market.apply(cmd);
    if (!res.ok) console.error(`[replay] command rejected during replay: ${cmd.type} ${res.error}`);
  }
  market.drain();
  commandCount = log.length;
  sessions.clear();
  tokenToTeam.clear();
  for (const [teamId, token] of Object.entries(await store.loadSessions())) {
    sessions.set(teamId, token);
    tokenToTeam.set(token, teamId);
  }
  console.log(`[market] competition ${id} (${store.kind} store): replayed ${log.length} commands → round ${market.round} ${market.phase}`);
  // The wall clock kept running while the server was down. Never let a restart
  // silently close a round: pause it and let the organiser resume deliberately.
  if (["NEWS", "TRADING", "SETTLING"].includes(market.phase) && !market.paused) {
    exec({ type: "PAUSE", ts: Date.now() });
    exec({ type: "ADMIN_AUDIT", ts: Date.now(), action: "AUTO_PAUSE", detail: "Server restarted mid-round; market paused until the organiser resumes" });
    console.log("[market] auto-paused after restart — resume from the organiser console");
  }
}

/** The only way state changes: apply → persist → project → broadcast. */
function exec(cmd: Command) {
  const res = market.apply(cmd);
  if (res.ok && !res.duplicate) {
    store.append(cmd);
    commandCount++;
  }
  store.project(market.drain());
  if (res.ok) dirty = true;
  return res;
}

// ---------------------------------------------------------------- http
async function main() {
  await openCompetition(currentCompetitionId());
  const app = next({ dev: !PROD });
  const handle = app.getRequestHandler();
  await app.prepare();

  const server = createServer((req, res) => {
    if (req.url?.startsWith("/api/")) return api(req, res);
    handle(req, res);
  });
  const io = new Server(server, { serveClient: false, pingInterval: 5000, pingTimeout: 8000 });

  io.on("connection", (socket) => onConnection(io, socket));

  // Master clock: the server alone decides when phases change.
  setInterval(() => {
    const now = Date.now();
    if (market.isDue(now)) exec({ type: "ADVANCE", actor: "clock", ts: now });
  }, 200);

  // Throttled broadcast (≤ 4 per second). Views are anonymised in engine/views.ts.
  setInterval(() => broadcast(io), 250);
  setInterval(() => (dirty = true), 2000); // heartbeat so clients resync clock & health

  server.listen(PORT, () => console.log(`[http] The Information War on http://localhost:${PORT}  (terminal: /  organiser: /admin)`));
}

function api(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url!, "http://x");
  if (url.pathname === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, phase: market.phase, round: market.round, store: store.kind, pending: store.pending() }));
  }
  if (url.pathname.startsWith("/api/export/")) {
    if (req.headers["x-admin-key"] !== ADMIN_KEY) {
      res.writeHead(401);
      return res.end("unauthorized");
    }
    const kind = url.pathname.slice("/api/export/".length).replace(/\.(csv|jsonl)$/, "");
    const body = exportCsv(market, kind, () => store.loadCommands());
    return Promise.resolve(body).then((b) => {
      if (b === null) {
        res.writeHead(404);
        return res.end("unknown export");
      }
      res.writeHead(200, { "content-type": kind === "commands" ? "application/x-ndjson" : "text/csv", "content-disposition": `attachment; filename="${competitionId}-${kind}.${kind === "commands" ? "jsonl" : "csv"}"` });
      res.end(b);
    });
  }
  res.writeHead(404);
  res.end();
}

// ---------------------------------------------------------------- sockets
type Role = { kind: "team"; teamId: string } | { kind: "admin" } | { kind: "guest" };

function onConnection(io: Server, socket: Socket) {
  let role: Role = { kind: "guest" };
  const bucket: number[] = [];
  const throttled = () => {
    const now = Date.now();
    while (bucket.length && now - bucket[0] > 10_000) bucket.shift();
    bucket.push(now);
    return bucket.length > 40;
  };

  const auth = socket.handshake.auth as { token?: string; adminKey?: string };
  if (auth.adminKey) {
    if (auth.adminKey === ADMIN_KEY) role = { kind: "admin" };
  } else if (auth.token && tokenToTeam.has(auth.token)) {
    role = { kind: "team", teamId: tokenToTeam.get(auth.token)! };
  }
  if (role.kind === "team") {
    socket.join(`team:${role.teamId}`);
    lastSeen.set(role.teamId, Date.now());
  }
  if (role.kind === "admin") socket.join("admin");
  socket.emit("hello", { role: role.kind, team: role.kind === "team" ? market.teamById.get(role.teamId)?.name : undefined });
  sendNow(socket, role);

  socket.on("login", (payload: { code?: string }, ack?: (r: unknown) => void) => {
    if (typeof ack !== "function") return;
    if (throttled()) return ack({ ok: false, error: "Too many attempts" });
    const code = String(payload?.code ?? "").trim().toUpperCase();
    const team = market.teams.find((t) => t.code === code);
    if (!team) return ack({ ok: false, error: "Unknown team code" });
    if (sessions.has(team.id)) return ack({ ok: false, error: "This team is already signed in on another device. Ask the organiser to reset access." });
    const token = randomBytes(24).toString("hex");
    sessions.set(team.id, token);
    tokenToTeam.set(token, team.id);
    store.setSession(team.id, token);
    exec({ type: "ADMIN_AUDIT", ts: Date.now(), action: "TEAM_LOGIN", detail: `${team.name} signed in` });
    ack({ ok: true, token, team: team.name });
  });

  socket.on("cmd", (payload: unknown, ack?: (r: unknown) => void) => {
    if (typeof ack !== "function") return;
    if (role.kind !== "team") return ack({ ok: false, error: "Not signed in" });
    if (throttled()) return ack({ ok: false, error: "Slow down" });
    lastSeen.set(role.teamId, Date.now());
    const parsed = TeamCommand.safeParse(payload);
    if (!parsed.success) return ack({ ok: false, error: "Invalid request" });
    const c = parsed.data;
    const ts = Date.now();
    const teamId = role.teamId;
    let cmd: Command;
    switch (c.type) {
      case "PLACE_ORDER": {
        const cents = c.price === undefined ? undefined : toCents(c.price);
        if (cents === null) return ack({ ok: false, error: "Prices have at most 2 decimals" });
        cmd = { type: "PLACE_ORDER", ts, teamId, orderId: randomUUID(), clientOrderId: c.clientOrderId, ticker: c.ticker, side: c.side, orderType: c.orderType, price: c.orderType === "LIMIT" ? cents : undefined, qty: c.qty };
        break;
      }
      case "MODIFY_ORDER": {
        const cents = c.price === undefined ? undefined : toCents(c.price);
        if (cents === null) return ack({ ok: false, error: "Prices have at most 2 decimals" });
        cmd = { type: "MODIFY_ORDER", ts, teamId, orderId: c.orderId, price: cents, qty: c.qty };
        break;
      }
      case "CANCEL_ORDER":
        cmd = { type: "CANCEL_ORDER", ts, teamId, orderId: c.orderId };
        break;
      case "BUY_RESEARCH":
        cmd = { type: "BUY_RESEARCH", ts, teamId, researchId: c.researchId };
        break;
      case "SUBMIT_FORECAST":
        cmd = { type: "SUBMIT_FORECAST", ts, teamId, round: c.round, direction: c.direction };
        break;
    }
    const res = exec(cmd);
    ack(res);
    if (res.ok) io.to(`team:${teamId}`).emit("team", teamView(market, teamId));
  });

  socket.on("admin", async (payload: unknown, ack?: (r: unknown) => void) => {
    if (typeof ack !== "function") return;
    if (role.kind !== "admin") return ack({ ok: false, error: "Not authorised" });
    const parsed = AdminCommand.safeParse(payload);
    if (!parsed.success) return ack({ ok: false, error: "Invalid request: " + parsed.error.issues[0]?.message });
    const c = parsed.data;
    const ts = Date.now();
    switch (c.type) {
      case "SETUP_TEAMS": {
        const used = new Set<string>();
        const teams = Array.from({ length: c.count }, (_, i) => {
          let code: string;
          do code = teamCode();
          while (used.has(code));
          used.add(code);
          return { id: `team-${i + 1}-${randomBytes(3).toString("hex")}`, number: i + 1, name: c.names?.[i]?.trim() || `Team ${String(i + 1).padStart(2, "0")}`, code };
        });
        const res = exec({ type: "SETUP_TEAMS", ts, teams });
        if (res.ok) {
          for (const id of [...sessions.keys()]) store.setSession(id, null);
          sessions.clear();
          tokenToTeam.clear();
        }
        return ack(res);
      }
      case "NOTE":
        return ack(exec({ type: "ADMIN_AUDIT", ts, action: "NOTE", detail: c.text }));
      case "RESET_SESSION": {
        const team = market.teamById.get(c.teamId);
        if (!team) return ack({ ok: false, error: "Unknown team" });
        const token = sessions.get(team.id);
        if (token) tokenToTeam.delete(token);
        sessions.delete(team.id);
        store.setSession(team.id, null);
        io.in(`team:${team.id}`).emit("kicked", "Your session was reset by the organiser. Sign in again with your team code.");
        io.in(`team:${team.id}`).disconnectSockets(true);
        return ack(exec({ type: "ADMIN_AUDIT", ts, action: "RESET_SESSION", detail: `Session reset for ${team.name}` }));
      }
      case "NEW_COMPETITION": {
        if (market.phase !== "LOBBY" && market.phase !== "FINISHED") return ack({ ok: false, error: "Finish or terminate the current event first" });
        await store.flush();
        const id = setCurrentCompetitionId(`comp-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`);
        await openCompetition(id);
        io.emit("kicked", "A new competition has been created.");
        io.disconnectSockets(true);
        dirty = true;
        return ack({ ok: true });
      }
      default:
        return ack(exec({ ...c, ts } as Command));
    }
  });
}

function sendNow(socket: Socket, role: Role) {
  const now = Date.now();
  socket.emit("public", publicView(market, now));
  if (role.kind === "team") socket.emit("team", teamView(market, role.teamId));
  if (role.kind === "admin") socket.emit("adminState", { ...adminView(market, now), health: health() });
}

function broadcast(io: Server) {
  if (!dirty) return;
  dirty = false;
  const now = Date.now();
  io.emit("public", publicView(market, now));
  for (const t of market.teams) {
    const room = io.sockets.adapter.rooms.get(`team:${t.id}`);
    if (room?.size) io.to(`team:${t.id}`).emit("team", teamView(market, t.id));
  }
  if (io.sockets.adapter.rooms.get("admin")?.size) io.to("admin").emit("adminState", { ...adminView(market, now), health: health(io) });
}

function health(io?: Server) {
  const connections: Record<string, number> = {};
  if (io) for (const t of market.teams) connections[t.id] = io.sockets.adapter.rooms.get(`team:${t.id}`)?.size ?? 0;
  return {
    competitionId,
    store: store.kind,
    scenarioHash: scenarioHash.slice(0, 16),
    scenarioLocked: scenario.meta.lockedAt,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    commands: commandCount,
    persistencePending: store.pending(),
    persistenceError: store.lastError(),
    connections,
    signedIn: Object.fromEntries([...sessions.keys()].map((k) => [k, true])),
    lastSeen: Object.fromEntries(lastSeen),
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function teamCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function loadDotEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env file
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
