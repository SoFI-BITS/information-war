# The Information War: Staff Operations Guide

**For:** Event Lead, Market Operator, Technical Support, Results Verifier. **Confidential: do not show to participants.**
**Event length:** 48 minutes target, 50-minute hard limit. **Teams:** 20–30, one laptop each.

---

## 1. Roles

| Role | Owns | Never does |
|---|---|---|
| **Event Lead** | Briefing, round announcements, keeping to time, winner announcement, debrief | Gives hints about stocks or signals |
| **Market Operator** | Organiser console (`/admin`): start, pause, resume, void round, terminate; watching health | Changes outcomes; pauses because of who is winning |
| **Technical Support** | Logins, devices, Wi-Fi, "Reset access" requests | Gives trading advice, or explains what a signal means |
| **Results Verifier** | Exports, checks the final leaderboard, keeps the event log | Edits results by hand |

In a small event one person can hold several roles. Still name one person for **technical issues** and one for **verifying results**.

---

## 2. The day before (T-1)

- [ ] Freeze the scenario. Set `meta.lockedAt` in `app/src/scenario/scenario.json` to the current timestamp. Then run `python -I tools/build_phase1.py` and `python -I tools/build_phase2.py` so the documents match the file.
- [ ] Run `npm test` (all pass) and `npm run simulate` (no strategy wins every run).
- [ ] Put the production `.env` on the event machine. It must have a strong `ADMIN_KEY` and, if using Postgres, `DATABASE_URL`. Run `npm run build`.
- [ ] Do a **full 10-round rehearsal** with at least 3 laptops plus bots. Check that every phase transition happens on time.
- [ ] Rehearse a failure. Stop the server mid-round, start it again, and confirm it comes back **paused** in the same round with the same positions. Resume.
- [ ] Rehearse a void. Use **Void & restart round** once, and confirm the trades are struck through and positions are restored.
- [ ] Check private-intelligence permissions. Sign in as teams in two different groups and confirm they see different signals.
- [ ] Print the rulebook PDF (1 per team) and the team-code sheet. Get the codes from Export → `teams`.

## 3. Event morning (T-60 min)

- [ ] Start the server: `npm start` (production). Confirm `/api/health` returns `ok`.
- [ ] Open `/admin`, then **New competition** (this gives a clean log), then **Register teams** with the exact count and names.
- [ ] Export `teams`, print it, and cut it into slips: team name, code, table number. Keep the intel-group column off the slips.
- [ ] Projector: show the organiser console's leaderboard view only between rounds, never the Market Monitor. The Market Monitor shows hidden fundamentals.
- [ ] Note the event machine's clock time. The server clock is the official clock.
- [ ] Prepare the backup plan (§7) and have the paper copies ready.

---

## 4. Run of show

| Clock | Duration | Who | What |
|---|---|---|---|
| 00:00 | 3:00 | Event Lead | Opening briefing (script §5) |
| 03:00 | 2:00 | Tech Support | Teams sign in. The console shows **Teams online N / N**. No trading yet (lobby). |
| 05:00 | — | Market Operator | **Start event**. Round 1 news is released. |
| 05:00–45:00 | 10 × 4:00 | Server clock | Each round runs automatically: 0:20 news → 3:20 trading → 0:20 settlement. |
| 45:00 | 3:00 | Event Lead | Final results, winner, Best Forecaster, short debrief teaser |
| 48:00 | — | | End. Contingency to 50:00. |

**Round clock reference** (time from Start event):

| Round | News opens | Trading closes | Next round |
|---|---|---|---|
| 1 | 05:00 | 08:40 | 09:00 |
| 2 | 09:00 | 12:40 | 13:00 |
| 3 | 13:00 | 16:40 | 17:00 |
| 4 | 17:00 | 20:40 | 21:00 |
| 5 | 21:00 | 24:40 | 25:00 |
| 6 | 25:00 | 28:40 | 29:00 |
| 7 | 29:00 | 32:40 | 33:00 |
| 8 | 33:00 | 36:40 | 37:00 |
| 9 | 37:00 | 40:40 | 41:00 |
| 10 | 41:00 | 44:40 | 45:00 (final results) |

---

## 5. Opening briefing script (3 minutes)

> **(0:00)** Welcome to *The Information War*. For the next 40 minutes you are a trading desk. Your job is simple to state: **finish with the most money**, measured as portfolio equity.
>
> **(0:20)** There are ten fictional companies, so nothing you know from the real world helps. Every team starts with exactly 100,000 credits: some cash, and a holding in every stock.
>
> **(0:40)** There are ten rounds of four minutes each. Each round opens with 20 seconds of news, then 3 minutes 20 seconds of trading, then 20 seconds while we settle. The clock on your screen is the official clock. When it hits zero, trading stops and every open order is cancelled.
>
> **(1:05)** Everyone gets the same public news. Some of you will also get **private intelligence**. It might be right, incomplete, out of date, or simply wrong. Each signal shows where it came from. You also have three research credits for the whole event to double-check things.
>
> **(1:30)** You can see every order and every trade in the market, but never *who* placed them. A big buyer might know something, or might be wrong, or might be bluffing.
>
> **(1:50)** This next point matters most. **Your score is not the last traded price.** At the end of each round we publish a *reference value* for each stock. It's based on what is really happening to the company, with only a small, capped influence from trading. One silly trade at a crazy price will not make anyone rich.
>
> **(2:15)** The rules: no short selling, no borrowing. Use limit orders to control your price. Market orders fill immediately at the best available prices, and they might not fill at all. Round 7 has thinner liquidity, and it says so in your rulebook.
>
> **(2:35)** No talking to other teams during trading. One device per team. Everything I do at this console is logged, and the scenario was locked before you walked in, so nobody can change the outcome mid-game.
>
> **(2:50)** Make the rules clear, make the information uncertain, make the consequences matter. Sign in now with the code on your slip.

---

## 6. Round transitions: what to say

Say one or two lines during each **settlement** phase (20 s), while the summary is on screens. **Never hint at direction.**

| Round starting | Announcement |
|---|---|
| 1 Initial Positions | "Round 1 is live. Read the news, check your intelligence, find your feet." |
| 2 Conflicting Signals | "Round 2. Not everyone has heard the same story." |
| 3 Crowd Behaviour | "Round 3. Watch the order book, and ask yourself why it's moving. Forecasts are open for this round, and they lock when trading opens." |
| 4 Supply-Chain Discovery | "Round 4. Think one step further down the chain." |
| 5 Macroeconomic Shift | "Round 5. A big-picture announcement is coming." |
| 6 Rumour and Verification | "Round 6. Rumours are flying. You may want those research credits now. Forecasts are open." |
| 7 Liquidity Shock | "Round 7. As the rulebook says, liquidity is thin this round. Mind your market orders." |
| 8 The Narrative Breaks | "Round 8. Are you still sure about what worked earlier?" |
| 9 Final Intelligence | "Round 9. The last round of intelligence. Forecasts are open." |
| 10 The Endgame | "Final round. Same rules, same limits. Trading stops at zero, and then we lock the board." |

**Market Operator watch list each round:** Teams online count, *pending writes* close to 0, no persistence error, and the countdown matches the event clock.

---

## 7. Technical fail-safes

**Rule of thumb:** pause first, think second. A pause stops the clock for everyone equally. Every resume leaves at least 30 seconds on the clock.

| Situation | Action | Log it |
|---|---|---|
| One team's laptop dies or the browser closes | Tech Support moves them to the spare laptop. If "already signed in", Market Operator clicks **Reset access** on that team, and the team signs in with the same code. Positions are safe on the server. **Do not pause** for one team. | Audit note, e.g. "T12 laptop swapped 14:22" |
| A team says an order "didn't go through" | Look at their **Open orders / My trades** tab. Repeated clicks are deduplicated, so check before they retry. | — |
| Venue Wi-Fi drops for several teams | **Pause**. Wait for "Teams online" to recover. **Resume**. | Automatic (pause/resume) + note |
| Server crash or restart | Restart with `npm start`. The server replays its log and comes back **paused** in the same phase. Confirm positions look right, announce, then **Resume**. | Automatic (AUTO_PAUSE) |
| Round outcome unreliable (outage longer than about 60 s during trading, or a clear system fault) | **Void & restart round**, with a reason. All of that round's trades are reversed and the round replays from its starting positions. Research already bought is kept, not refunded. Use this at most once. Announce the reason. | Reason required |
| Major failure with no recovery inside the 50-minute limit | **Terminate** with a reason. Results stand at the **last fully settled round**. | Reason required |
| Website completely unavailable | Use the backup: rank teams by the last exported `rounds` CSV. If no round has settled, run a paper forecast contest using the printed rulebook stocks. | Written record |

**Never:** change `scenario.json` during the event, give one team an extra pause, or void a round because of the leaderboard.

---

## 8. Final results (45:00–48:00)

1. When Round 10 settles, the console shows **FINISHED**. Every terminal shows the final leaderboard.
2. The Results Verifier exports **results**, **rounds**, **reference-values**, **trades**, **audit** and **commands**, and checks:
   - The top 3 equities on screen match `results.csv`.
   - The audit log has no unexpected admin actions.
   - Any tie is resolved by the published tie-breakers (realised P&L, then drawdown, then cash). The ranking already applies them.
3. The Event Lead announces 3rd, 2nd, 1st, then **Best Forecaster** (most forecast points; this is not part of the main ranking).
4. Highlight one or two market facts from `reference-values.csv`, such as the largest single-round move (SLRD −20% in Round 8) or the best stock overall.
5. Market Operator: **Reveal debrief**. Teams can now see the hidden state and how reliable every signal was.

---

## 9. Post-event debrief (optional 10–15 min)

Use these questions with the revealed scenario on screen:

1. **Which public news item was most misinterpreted?** Usually Round 2: Novatex's revenue rose 14%, but margin compression drove the stock down. Or Round 4: the port strike helped Tidewell.
2. **Which private signals were accurate, misleading or incomplete?** For example, "VX-7 approval is a formality" (Round 6) was true but incomplete, because the label was restricted. "The Arcwave board hired bankers" was true but misleading, because the bankers were for a bond issue, not a sale.
3. **Did teams follow the anonymous order flow too readily?** Compare Round 3 (the flow carried real information about renewables) with Round 7 (the bargain-hunting chatter about Harbourline was wrong).
4. **Which teams separated transaction price from underlying value?** Look for teams that bought below RV, or sold above it, during thin Round 7 liquidity.
5. **Did any team call a stock right but still lose money?** Check market orders that chased prices after the market maker's quotes had moved.
6. **Which risk-management decisions mattered most?** Concentration in SLRD before Round 8, or the size of positions taken in Round 7.
7. **Did teams overreact to the crisis, or hold on to outdated assumptions?** For example, holding Solaris Ridge after the subsidy was withdrawn because of the "temporary withdrawal" rumour.
8. **What did the event show about information asymmetry?** Each intel group's signals had a similar overall value. The differences came from interpreting them, not from luck in who got what.

Share `narrative-matrix.md`, the allocation matrix and the anonymised statistics (trade counts, largest moves) afterwards.
