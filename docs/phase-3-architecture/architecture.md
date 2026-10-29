# Phase 3: System Architecture

## 1. Shape of the system

```
 Team laptops (20–30)            Organiser laptop
 Next.js terminal  ──┐        ┌── Next.js /admin console
   socket.io client  │        │     socket.io client (admin key)
                     ▼        ▼
            ┌───────────────────────────────┐
            │  Node process (src/server)    │
            │  • Next.js page handler       │
            │  • Socket.IO real-time hub    │
            │  • Master clock (200 ms tick) │
            │  • Market engine (in memory)  │◄── scenario.json (locked, SHA-256 hashed)
            │      apply(command) → events  │
            └───────┬───────────────┬───────┘
                    │ append        │ project
                    ▼               ▼
          EngineCommand log   Order / TradeExecution / PortfolioSnapshot /
          (source of truth)   Holding / MarketEvent / AuditLog … (PostgreSQL)
          or data/<id>/commands.jsonl (file store)
```

**Why a single authoritative process?** A 30-team event peaks at a few dozen orders per second. One Node process handles that with ease. Because JavaScript runs on a single thread, every command is **atomic** without locks: two orders can't interleave, overspend cash or execute twice. That removes a whole class of concurrency bugs, and it is the main risk the design document calls out ("first ensure that simultaneous orders, cash accounting, round cutoffs and portfolio calculations are correct").

## 2. Event sourcing and recovery

- Every state change is a **command** (`PLACE_ORDER`, `ADVANCE`, `RESTART_ROUND`, …). The server stamps each command with its own timestamp and any generated ids *before* applying it.
- The engine is **deterministic**: it never reads the wall clock or random numbers itself. Replaying the command log rebuilds exactly the same state. A unit test checks this, and so does the Postgres integration check (`npm run db:check`).
- Accepted commands are appended to the log (`EngineCommand` table, or `commands.jsonl` appended synchronously). Rejected commands change nothing, so they aren't logged.
- **On restart** the server replays the log. If a round was in progress, it **auto-pauses**, because the wall clock kept running during the outage. The organiser then resumes, and at least 30 seconds always remain.
- The relational tables are **projections** written from engine events through one ordered queue. They power exports, audits and the debrief, and they never feed back into the engine.

## 3. Real-time strategy (Socket.IO)

| Channel | Audience | Content | Cadence |
|---|---|---|---|
| `public` | everyone | phase, clock, 10 stocks (RV, last trade, 8-level aggregated depth, RV history, recent prices), tape (last 60), news, round results, research catalogue, forecast question | throttled to at most 4/s when state changes, plus a 2 s heartbeat |
| `team` | room `team:<id>` | cash, reservations, positions, P&L, open orders, own fills, **own** signals, research results, forecasts, history | same throttle, plus immediately after the team's own command |
| `adminState` | room `admin` | everything, including hidden fundamentals, counterparties, audit and health | same throttle |
| `cmd` / `admin` / `login` | client → server | requests with an **ack** callback carrying the result (filled / partial / resting / unfilled / error) | on demand |

- **Server time:** every `public` message carries `serverTime`. Clients compute an offset and count down to the server's `phaseEndsAt`, so a client clock that is wrong doesn't matter.
- **Reconnect:** Socket.IO reconnects automatically, and every (re)connect receives a full snapshot. Nothing is incremental, so a missed message can't corrupt client state.
- **Duplicate clicks:** the ticket sends a `clientOrderId` that stays the same until a response arrives. The engine treats a repeated id as the same order.
- **Rate limits:** the engine allows 20 accepted actions per 10 s (published, deterministic). The socket layer also throttles each connection to 40 messages per 10 s.

## 4. Anonymity guarantees

Every byte a participant receives goes through `src/engine/views.ts`. Those view functions only *copy in* safe fields:

- The order book is aggregated by price level (price, quantity, number of orders). Order ids, team ids and timestamps are not included.
- The tape shows ticker, price, quantity and time rounded to the second. No ids.
- A team's own order ids are random UUIDs and are sent only to that team.
- Hidden fundamentals, signal truth, intel-group letters, other teams' signals and team codes never leave the server. The only exceptions are the admin view and the post-event debrief, which the organiser reveals.
- A unit test checks that the public view contains no team id, team code or market-maker marker.

## 5. Security and authority

- **Team login:** team code → random session token, stored in the browser's `localStorage`. **One active session per team.** A second device is refused until the organiser clicks *Reset access*.
- **Admin:** `ADMIN_KEY` in `.env`. It is required in production, and exports need the key in a header.
- **The server validates everything:** phase, ownership, price band, notional, cash, shares, position limit, open-order cap and rate limit. The browser only displays results. Input payloads are schema-validated (zod), and team identity comes from the session, never from the payload.
- **Integrity:** the SHA-256 of `scenario.json` is shown on the console and stored with the competition, which proves the configuration didn't change mid-event.

## 6. Database schema

The full Prisma schema is in [`app/prisma/schema.prisma`](../../app/prisma/schema.prisma), and the generated SQL is in [`app/prisma/migrations/0001_init/migration.sql`](../../app/prisma/migrations/0001_init/migration.sql).

| Entity | Purpose | Key fields |
|---|---|---|
| Competition | One event instance | status, scenarioVersion, scenarioHash, config |
| Team | Participant desk | number, name, code, group (A–F, organiser-only), sessionToken |
| Stock | The 10 fictional companies | ticker, startPriceCents, volatility |
| Round | Scenario round + lifecycle | hiddenState, fundamentals (organiser-only), startedAt, settledAt, voidedCount |
| PublicNewsItem | Common bulletins | roundNumber, headline, body |
| PrivateSignal | Pre-allocated intel | signalKey, ticker, text, source, reliability, groups[], truth |
| ResearchAction | Research credit spends | teamId, researchKey, roundNumber |
| Forecast | Optional prediction | teamId, roundNumber, ticker, direction |
| Order | Every team order and its final state | side, type, priceCents, qty, remaining, filled, status, seq (priority), clientOrderId |
| TradeExecution | Every execution (incl. market maker) | priceCents, qty, buy/sell team & order, aggressor, voided |
| Holding | Positions as of the last settlement | shares, avgCostCents, realizedCents |
| PortfolioSnapshot | Round-end marks | cash, holdings value, equity, realised, unrealised, rank |
| MarketEvent | Valuation and lifecycle facts | kind = REFERENCE_VALUE (rvStart, rvEnd, vwap, volume), ROUND_STARTED, ROUND_VOIDED |
| AuditLog | Append-only admin and clock actions | seq, actor, action, detail |
| EngineCommand | **Source of truth**: ordered command log | seq, type, payload, ts |

Money is stored as **integer cents**, never floats. Average cost is kept as a float only so that repeated averaging doesn't drift.

## 7. Deployment

| Option | When |
|---|---|
| **One laptop on the venue LAN** (`npm start`, file store) | Simplest and recommended for a single-room event. No internet dependency. Teams connect to `http://<laptop-ip>:3000`. |
| **Laptop + Postgres in Docker** (`npm run db:up`, `npm run db:migrate`, set `DATABASE_URL`) | When you want SQL queries and exports while the event runs. |
| **Cloud VM** (any Node 22 host + managed Postgres) | Remote or hybrid events. Run a single instance only: the engine is the single writer by design. Put it behind TLS. |

Don't run more than one server instance against the same competition.
