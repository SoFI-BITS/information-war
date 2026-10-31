# The Information War

A 48-minute trading-floor simulation competition: 20–30 teams trade 10 fictional stocks over 10 four-minute rounds, using incomplete, uneven and sometimes misleading information.
 
## What's here

| Phase | Deliverable | Location |
|---|---|---|
| 1 · Content | 10 stocks, 10-round narrative matrix, signal allocation & balance check | [docs/phase-1-content/](docs/phase-1-content/): `stocks.md`, `narrative-matrix.md` (organiser-only), `information-war-phase1.xlsx` |
| 2 · Documentation | Participant rulebook (2-page PDF + Markdown), staff run-of-show & fail-safes | [docs/phase-2-documentation/](docs/phase-2-documentation/) |
| 3 · Architecture | Real-time and persistence design, Prisma schema, SQL migration | [docs/phase-3-architecture/architecture.md](docs/phase-3-architecture/architecture.md), [app/prisma/](app/prisma/) |
| 4 · Engine | Price-time CLOB, market maker, reference-value & P&L engine, tests, calibration | [app/src/engine/](app/src/engine/), [docs/phase-4-engine/](docs/phase-4-engine/) |
| 5 · Interfaces | Participant terminal (`/terminal`), organiser console (`/admin`) | [app/src/app/](app/src/app/), [app/src/components/](app/src/components/) |

**Single source of truth:** [`app/src/scenario/scenario.json`](app/src/scenario/scenario.json). The server, the Excel workbook and the rulebook are all generated from it.

## Run it

Requires Node 22. Python 3 with `openpyxl` and `reportlab` is only needed to regenerate the documents.

```bash
cd app
npm install
cp .env.example .env    # set ADMIN_KEY
npm run dev             # http://localhost:3000 (team sign-in), /admin (organiser)
```

Event day (production build, zero-setup file store in `app/data/`):

```bash
npm run build
npm start
```

With PostgreSQL instead of the file store:

```bash
npm run db:up           # postgres:16 on localhost:54330 (docker compose)
npm run db:migrate      # applies prisma/migrations
# set DATABASE_URL and DIRECT_URL=postgresql://infowar:infowar@localhost:54330/infowar in .env
npm run db:check        # integration check: projections + replay equality
```

With Supabase (or another pooled host), set `DATABASE_URL` to the transaction pooler (port 6543, `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` to the session pooler (port 5432). Migrations run over `DIRECT_URL`. Percent-encode special characters in the password (`@` → `%40`). Outbound ports 5432 and 6543 must be open on the network you run from. Some venue and office networks block them; check with a hotspot, or apply `prisma/migrations/0001_init/migration.sql` in the Supabase SQL Editor instead.

## Host it

The server is one long-running Node process (Next.js pages, the Socket.IO channel and the engine's clock). Serverless hosts such as Vercel only serve the pages, so the terminal and organiser console sit on "Connecting…" forever. Use a host that runs `npm start` as a persistent process:

- **Render:** New → Blueprint, pick this repo. [`render.yaml`](render.yaml) sets the root directory, build, start and health check. Fill in `ADMIN_KEY`, `DATABASE_URL` and `DIRECT_URL` when prompted.
- **Railway:** New project → Deploy from GitHub repo, set the service's root directory to `app` ([`app/railway.json`](app/railway.json) holds the rest), then add the same three variables.

On either host:

- Run exactly **one** instance. State lives in memory; a second replica would be a second writer.
- Use **PostgreSQL**. The disk is wiped on every deploy, so the file store would lose the event. With no local `data/current.json`, the server resumes the newest competition in the database.
- Don't point a local `npm run dev` at the same database during the event. It is another writer for the same competition.
- Avoid free plans that sleep when idle. Waking drops every socket, and a restart pauses the market until the organiser resumes it.

## Check it

```bash
npm test                # 21 engine tests (matching, risk, settlement, replay, anonymity)
npm run simulate        # 20 bot competitions → docs/phase-4-engine/calibration-report.md
npm run typecheck
```

Regenerate the documents after editing the scenario:

```bash
python -I tools/balance_signals.py   # only if you change signals: re-balances intel groups
python -I tools/build_phase1.py      # stocks.md, narrative-matrix.md, xlsx
python -I tools/build_phase2.py      # participant rulebook .md + .pdf
```

## Organiser flow

`/admin` → **Register teams** (count + names) → print Export → `teams` → teams sign in → **Start event** → the server clock runs all 10 rounds → **Reveal debrief** → exports. Pause, void-and-restart and terminate are logged with a reason. See the [staff operations guide](docs/phase-2-documentation/staff-operations-guide.md).
