# Phase 1 — Ten-Round Narrative Matrix (ORGANISER ONLY — CONFIDENTIAL)

> This file reveals the hidden economic state and the truth of every private signal. Do not share with participants before the debrief.

## How private intelligence is allocated

Teams are placed in **6 intel groups (A, B, C, D, E, F)** by team number: team 1 → A, team 2 → B, … team 6 → F, team 7 → A, and so on. With 20–30 teams each group has 3–5 teams.

Every round has three private signals. Each signal goes to **two groups** (about a third of all teams), so every team receives exactly one signal per round, but no two groups see the same set of signals across the event. Pairings were chosen by `tools/balance_signals.py` to balance each group's expected value.

Reliability classes: **ACCURATE** · **INCOMPLETE** (true but missing the key fact) · **OUTDATED** (was true; no longer) · **MISLEADING** (false or wrong meaning).

## Hidden fundamental path (reference-value anchor)

Percent change of each company's hidden fundamental value per round. The reference value tracks this, plus a capped 30% pull toward the round's traded VWAP (max ±6%).

| Ticker | Start | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | Final F | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| NVTX | 142 | +3% | -7% | +2% | -3% | -8% | +3% | -3% | +5% | +4% | +2% | 137.78 | -3.0% |
| HBFG | 88 | +1% | +2% | +0% | +0% | +10% | +2% | -9% | +3% | -4% | -5% | 86.95 | -1.2% |
| PTRL | 74 | -2% | +1% | -4% | +2% | -3% | +4% | +2% | +14% | -3% | +3% | 84.06 | +13.6% |
| CLVH | 126 | +2% | +5% | +1% | +0% | +2% | +6% | +1% | -12% | -2% | +3% | 132.21 | +4.9% |
| MRLW | 64 | +1% | -1% | +2% | -9% | -5% | +3% | -2% | +4% | +5% | +6% | 65.93 | +3.0% |
| FRGE | 96 | +2% | -2% | +3% | -5% | -4% | +4% | -3% | -6% | +3% | +2% | 89.80 | -6.5% |
| TDWL | 68 | +0% | +1% | +1% | +9% | -2% | -6% | -2% | +2% | +2% | -3% | 68.89 | +1.3% |
| ARCM | 82 | -1% | +0% | -3% | +1% | -4% | -2% | -3% | +3% | +8% | +2% | 82.35 | +0.4% |
| GRNF | 61 | +1% | +2% | -1% | -6% | +1% | +4% | +1% | +0% | +3% | +7% | 68.38 | +12.1% |
| SLRD | 110 | +3% | +1% | +8% | -2% | -12% | +2% | -4% | -20% | +5% | -3% | 85.04 | -22.7% |

## Round-by-round matrix

### Round 1 — Initial Positions

**Purpose:** Teach the market and establish opening beliefs. Calm round, no shock.

**Hidden state:** Economy steady. Small, mostly positive drifts. Petralis licence decision quietly delayed.

**Common news (all teams):**

- **Valdoria GDP grows 1.8%, in line with forecasts** — The Statistics Office reports steady third-quarter growth. Consumer confidence is unchanged. Novatex confirms its flagship handset launches next month.
- **Energy ministry to rule on new offshore licences 'in due course'** — Petralis Energy is among the applicants. No date has been set.

**Fundamental moves:** NVTX +3%, HBFG +1%, PTRL -2%, CLVH +2%, MRLW +1%, FRGE +2%, TDWL +0%, ARCM -1%, GRNF +1%, SLRD +3%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S1-1 | A, D | NVTX | Industry contact | Novatex handset pre-orders are tracking ahead of last year's launch. | Up | ACCURATE | +3% | True. Small positive effect this round. |
| S1-2 | B, E | PTRL | Market chatter | Petralis is about to be awarded a large new offshore licence. | Up | MISLEADING | -2% | False. The decision was delayed indefinitely. |
| S1-3 | C, F | SLRD | Analyst research | Solaris Ridge's quarterly installations came in slightly above plan. | Up | ACCURATE | +3% | True. Small positive effect. |

**Research available (1 credit each):**

- `R1-1` *Petralis licence: second source* → A ministry official says no licence decisions will be made this quarter.

### Round 2 — Conflicting Signals

**Purpose:** Test trust in private information versus public evidence. Signals about Novatex conflict.

**Hidden state:** Novatex margin compression is structural (component costs), outweighing strong unit sales. Calvera interim data genuinely strong.

**Common news (all teams):**

- **Novatex: revenue up 14%, gross margin falls from 41% to 36%** — Management calls the margin decline 'temporary' but gives no timetable.
- **Calvera publishes interim VX-7 trial data** — The arthritis drug shows a 'statistically significant' improvement. Full data and a regulatory decision are expected later this season.

**Fundamental moves:** NVTX -7%, HBFG +2%, PTRL +1%, CLVH +5%, MRLW -1%, FRGE -2%, TDWL +1%, ARCM +0%, GRNF +2%, SLRD +1%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S2-1 | D, F | NVTX | Industry contact | Retail channel checks: stores are reordering Novatex devices; demand is strong. | Up | INCOMPLETE | -7% | Demand really is strong, but margins matter more to value. Stock fell. |
| S2-2 | B, C | CLVH | Analyst research | Detailed VX-7 tables show the effect size is larger than the headline suggests. | Up | ACCURATE | +5% | True. |
| S2-3 | A, E | NVTX | Analyst research | Novatex's margin decline will continue into next year as component contracts reprice. | Down | ACCURATE | -7% | True. The margin issue is structural. |

**Research available (1 credit each):**

- `R2-1` *Novatex margin breakdown* → Component costs rose 9% and are locked in by annual contracts. No margin recovery is guided for next quarter.

### Round 3 — Crowd Behaviour

**Purpose:** Make anonymous order flow strategically relevant. Teams decide whether flow is information or noise.

**Hidden state:** Subsidy hearings are genuinely positive for renewables and their suppliers. Spectrum auction will be expensive for Arcwave.

**Common news (all teams):**

- **Parliament opens hearings on the Renewable Infrastructure Subsidy Act** — A vote is expected later this season. Energy producers warn of higher carbon costs.
- **Telecom regulator opens consultation on the 6G spectrum auction** — Reserve prices have not been published.

**Fundamental moves:** NVTX +2%, HBFG +0%, PTRL -4%, CLVH +1%, MRLW +2%, FRGE +3%, TDWL +1%, ARCM -3%, GRNF -1%, SLRD +8%

**Forecast question:** Will SLRD's reference value finish this round higher or lower than it started?

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S3-1 | D, E | SLRD | Industry contact | A large institutional fund is quietly accumulating renewable-infrastructure stocks. | Up | ACCURATE | +8% | True, and the fundamentals supported it. |
| S3-2 | A, C | ARCM | Market chatter | Arcwave expects to win 6G spectrum cheaply because few rivals will bid. | Up | MISLEADING | -3% | False. Reserve prices will be high. |
| S3-3 | B, F | FRGE | Industry contact | Forgeline has quietly signed a supply deal for wind-turbine gearboxes. | Up | ACCURATE | +3% | True. Second-order beneficiary of the subsidy story. |

**Research available (1 credit each):**

- `R3-1` *6G auction reserve prices* → Draft documents suggest reserve prices roughly double the last auction.

### Round 4 — Supply-Chain Discovery

**Purpose:** Test second-order reasoning. One disruption helps one company and hurts others.

**Hidden state:** Port strike hurts importers and exporters; Tidewell's inland rail corridor earns emergency surcharges and is a net winner.

**Common news (all teams):**

- **Dockworkers' strike shuts the Port of Ashmouth** — Valdoria's largest container port is expected to remain closed for about ten days. Ships are queuing offshore.

**Fundamental moves:** NVTX -3%, HBFG +0%, PTRL +2%, CLVH +0%, MRLW -9%, FRGE -5%, TDWL +9%, ARCM +1%, GRNF -6%, SLRD -2%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S4-1 | A, F | TDWL | Industry contact | Tidewell's rail-freight corridor is fully booked at emergency rates for the next month. | Up | ACCURATE | +9% | True. Tidewell is a net winner from the strike. |
| S4-2 | B, D | MRLW | Market chatter | Marlowe & Kent brought its holiday stock in early this year, before the strike. | Up | MISLEADING | -9% | False. Most holiday stock is stuck on ships at Ashmouth. |
| S4-3 | C, E | FRGE | Analyst research | Forgeline's critical imported bearings are sitting in containers at Ashmouth. | Down | ACCURATE | -5% | True. Production delays. |

**Research available (1 credit each):**

- `R4-1` *Who depends on Ashmouth?* → Marlowe & Kent: ~70% of holiday imports. Greenfield: ~40% of exports. Forgeline: key bearings. Tidewell runs the only inland rail alternative.

### Round 5 — Macroeconomic Shift

**Purpose:** Introduce cross-stock relationships. A rate shock moves sectors in different directions.

**Hidden state:** Rate hike: banks win; leveraged and growth companies lose; defensives hold up.

**Common news (all teams):**

- **Central Bank surprises with a 0.75-point rate rise** — The Bank signals further increases to fight inflation. The Valdorian crown strengthens sharply against major currencies.

**Fundamental moves:** NVTX -8%, HBFG +10%, PTRL -3%, CLVH +2%, MRLW -5%, FRGE -4%, TDWL -2%, ARCM -4%, GRNF +1%, SLRD -12%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S5-1 | B, E | HBFG | Industry contact | Harbourline's treasury desk expects its lending margin to widen sharply after the hike. | Up | ACCURATE | +10% | True. |
| S5-2 | C, F | ARCM | Analyst research | Arcwave refinanced all of its debt at fixed rates, so rate rises won't hurt it. | Up | OUTDATED | -4% | Outdated. Only half was refinanced; the rest floats. |
| S5-3 | A, D | SLRD | Market chatter | Solaris Ridge is about to announce a state-guaranteed loan that shields it from rate rises. | Up | MISLEADING | -12% | False. Talks collapsed. |

**Research available (1 credit each):**

- `R5-1` *Debt and rate-sensitivity table* → Floating-rate debt as share of total: Solaris Ridge 65%, Arcwave 50%, Tidewell 30%, Novatex 10%. Harbourline earns more on floating-rate loans.

### Round 6 — Rumour and Verification

**Purpose:** Make research credits valuable. Two rumours: one partly true, one false.

**Hidden state:** VX-7 approval comes with a restricted label (smaller market than hoped). Arcwave takeover is false. Port strike settles.

**Common news (all teams):**

- **Reports: Calvera's VX-7 approval 'imminent'** — Unconfirmed reports say the regulator will approve the arthritis drug this week.
- **Blog claims Arcwave is a takeover target** — A financial blog says a foreign operator is preparing a bid. Arcwave declined to comment.

**Fundamental moves:** NVTX +3%, HBFG +2%, PTRL +4%, CLVH +6%, MRLW +3%, FRGE +4%, TDWL -6%, ARCM -2%, GRNF +4%, SLRD +2%

**Forecast question:** Will CLVH's reference value finish this round higher or lower than it started?

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S6-1 | C, D | CLVH | Industry contact | A regulator staffer says VX-7 approval is 'a formality'. | Up | INCOMPLETE | +6% | Approval is real, but the label is restricted to severe cases. Gain smaller than the hype. |
| S6-2 | E, F | ARCM | Market chatter | Arcwave's board has hired investment bankers. | Up | MISLEADING | -2% | True fact, wrong meaning: the bankers are arranging a bond issue, not a sale. |
| S6-3 | A, B | TDWL | Analyst research | The Ashmouth strike was settled overnight; the port reopens tomorrow. | Down | ACCURATE | -6% | True. Tidewell's surcharges end; importers and exporters recover. |

**Research available (1 credit each):**

- `R6-1` *Verify the VX-7 approval rumour* → Second source: approval is expected, but the label will likely be restricted to severe cases (about a third of the target market).
- `R6-2` *Verify the Arcwave takeover rumour* → Second source: the banker mandate is for a bond refinancing. No bidder has been identified.
- `R6-3` *Port of Ashmouth status* → Union and port authority have a draft agreement; vote scheduled tonight.

### Round 7 — Liquidity Shock

**Purpose:** Test execution and risk management. Market-maker capacity drops, spreads widen (pre-announced in the rulebook).

**Hidden state:** Harbourline's hedge-fund exposure is larger than admitted. Broad risk-off move.

**Common news (all teams):**

- **Hedge fund Corvane Capital collapses** — Harbourline Financial confirms 'manageable' exposure. Several lenders are reviewing positions.
- **Exchange notice: reduced liquidity this round** — As set out in the rulebook, market-maker spreads are wider and depth is thinner in all stocks for Round 7.

**Fundamental moves:** NVTX -3%, HBFG -9%, PTRL +2%, CLVH +1%, MRLW -2%, FRGE -3%, TDWL -2%, ARCM -3%, GRNF +1%, SLRD -4%

**Liquidity override:** market-maker half-spread 3.0%, 2 levels × 2,500 credits, skew 2.0% per 10k net flow (cap 12%).

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S7-1 | C, D | HBFG | Analyst research | Harbourline's Corvane exposure is about three times the amount it has disclosed. | Down | ACCURATE | -9% | True. |
| S7-2 | B, F | HBFG | Market chatter | Bargain hunters are lining up for Harbourline; the sell-off is overdone. | Up | MISLEADING | -9% | False. Losses were larger than disclosed. |
| S7-3 | A, E | PTRL | Industry contact | Petralis has hedged most of next year's output at today's high prices. | Up | ACCURATE | +2% | True. Small positive effect; defensive in a risk-off market. |

**Research available (1 credit each):**

- `R7-1` *Independent Harbourline exposure estimate* → Exposure is roughly 4% of the bank's equity: painful, not fatal. Dividend at risk.

### Round 8 — The Narrative Breaks

**Purpose:** Challenge previously successful assumptions. The renewables and Calvera stories reverse.

**Hidden state:** Subsidy act withdrawn for good; energy policy swings back to fossil fuels. A rival drug beats VX-7. Novatex launch succeeds.

**Common news (all teams):**

- **Budget crisis: government withdraws the Renewable Subsidy Act** — The Treasury announces a full review of energy policy.
- **Ostrava Pharma launches rival arthritis drug** — Its trial results beat VX-7 and it will be sold at a lower price.

**Fundamental moves:** NVTX +5%, HBFG +3%, PTRL +14%, CLVH -12%, MRLW +4%, FRGE -6%, TDWL +2%, ARCM +3%, GRNF +0%, SLRD -20%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S8-1 | C, E | SLRD | Industry contact | Ministry insiders say the subsidy withdrawal is temporary; the act returns within weeks. | Up | MISLEADING | -20% | False. No reintroduction before the next election. |
| S8-2 | D, F | NVTX | Industry contact | Novatex's new handset sold out in its first weekend. | Up | ACCURATE | +5% | True. |
| S8-3 | A, B | CLVH | Analyst research | Ostrava's drug faces manufacturing problems that will limit supply for a year. | Up | OUTDATED | -12% | Outdated. The problems were fixed last month. |

**Research available (1 credit each):**

- `R8-1` *Will the subsidy act return?* → Treasury sources: no reintroduction before the next election.
- `R8-2` *Ostrava manufacturing check* → Ostrava's plant passed regulatory inspection last month. Supply constraints are resolved.

### Round 9 — Final Intelligence

**Purpose:** Weigh new evidence against existing positions. Balanced final clues; one points to next round.

**Hidden state:** Inflation cooling: rate-sensitive stocks rebound, banks give back gains. Arcwave deal is genuinely valuable.

**Common news (all teams):**

- **Inflation falls faster than expected** — Economists now expect the Central Bank to pause rate rises.
- **Arcwave signs network-sharing deal with a regional operator** — Financial terms were not disclosed.

**Fundamental moves:** NVTX +4%, HBFG -4%, PTRL -3%, CLVH -2%, MRLW +5%, FRGE +3%, TDWL +2%, ARCM +8%, GRNF +3%, SLRD +5%

**Forecast question:** Will ARCM's reference value finish this round higher or lower than it started?

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S9-1 | B, C | ARCM | Analyst research | Arcwave's network-sharing deal cuts its capital spending by about a quarter. | Up | ACCURATE | +8% | True. |
| S9-2 | A, F | GRNF | Industry contact | Greenfield's harvest yields hit a record; it reports full-year results next round. | Up (R10) | ACCURATE | +7% | True. The payoff arrives in Round 10, not Round 9. |
| S9-3 | D, E | HBFG | Market chatter | Harbourline will announce a large special dividend at year-end. | Up | MISLEADING | -4% | False. The dividend is suspended in Round 10. |

**Research available (1 credit each):**

- `R9-1` *Extra macro indicator: core inflation* → Core inflation 2.1%, down from 3.4% two months ago.

### Round 10 — The Endgame

**Purpose:** Close cleanly. Same rules and limits; no special final mechanic.

**Hidden state:** Full-year results: consumer recovery, record harvest, Harbourline suspends dividend, freight normalises.

**Common news (all teams):**

- **Results day: all ten companies report full-year numbers** — Headline: Valdoria avoids recession as consumer spending recovers. This is the final trading round.

**Fundamental moves:** NVTX +2%, HBFG -5%, PTRL +3%, CLVH +3%, MRLW +6%, FRGE +2%, TDWL -3%, ARCM +2%, GRNF +7%, SLRD -3%

| Signal | Groups | Ticker | Source (shown) | Text shown to teams | Implies | True class | Actual move | Truth (debrief) |
|---|---|---|---|---|---|---|---:|---|
| S10-1 | B, D | MRLW | Industry contact | Marlowe & Kent's holiday sales are running 9% above last year. | Up | ACCURATE | +6% | True. |
| S10-2 | A, C | TDWL | Market chatter | Tidewell will announce a large share buyback with its results. | Up | MISLEADING | -3% | False. Freight volumes normalise and no buyback is announced. |
| S10-3 | E, F | CLVH | Analyst research | Calvera's full-year results include a one-off licensing gain. | Up | ACCURATE | +3% | True. Modest positive effect. |

**Research available (1 credit each):**

- `R10-1` *Harbourline dividend check* → Board minutes show the dividend is 'under review' because of Corvane losses.

## Allocation matrix (signal received by each group)

| Round | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| 1 | S1-1 (ACC) | S1-2 (MIS) | S1-3 (ACC) | S1-1 (ACC) | S1-2 (MIS) | S1-3 (ACC) |
| 2 | S2-3 (ACC) | S2-2 (ACC) | S2-2 (ACC) | S2-1 (INC) | S2-3 (ACC) | S2-1 (INC) |
| 3 | S3-2 (MIS) | S3-3 (ACC) | S3-2 (MIS) | S3-1 (ACC) | S3-1 (ACC) | S3-3 (ACC) |
| 4 | S4-1 (ACC) | S4-2 (MIS) | S4-3 (ACC) | S4-2 (MIS) | S4-3 (ACC) | S4-1 (ACC) |
| 5 | S5-3 (MIS) | S5-1 (ACC) | S5-2 (OUT) | S5-3 (MIS) | S5-1 (ACC) | S5-2 (OUT) |
| 6 | S6-3 (ACC) | S6-3 (ACC) | S6-1 (INC) | S6-1 (INC) | S6-2 (MIS) | S6-2 (MIS) |
| 7 | S7-3 (ACC) | S7-2 (MIS) | S7-1 (ACC) | S7-1 (ACC) | S7-3 (ACC) | S7-2 (MIS) |
| 8 | S8-3 (OUT) | S8-3 (OUT) | S8-1 (MIS) | S8-2 (ACC) | S8-1 (MIS) | S8-2 (ACC) |
| 9 | S9-2 (ACC) | S9-1 (ACC) | S9-1 (ACC) | S9-3 (MIS) | S9-3 (MIS) | S9-2 (ACC) |
| 10 | S10-2 (MIS) | S10-1 (ACC) | S10-2 (MIS) | S10-1 (ACC) | S10-3 (ACC) | S10-3 (ACC) |

## Balance check

Edge = implied direction × actual fundamental move (percentage points). A team that traded every signal naively at equal size would earn roughly proportional to this.

| Group | Signals | Accurate | Incomplete | Outdated | Misleading | Total edge |
|---|---:|---:|---:|---:|---:|---:|
| A | 10 | 6 | 0 | 1 | 3 | +4 |
| B | 10 | 6 | 0 | 1 | 3 | +6 |
| C | 10 | 5 | 1 | 1 | 3 | +6 |
| D | 10 | 5 | 2 | 0 | 3 | +5 |
| E | 10 | 6 | 0 | 0 | 4 | +7 |
| F | 10 | 6 | 1 | 1 | 2 | +8 |

Stated source reliability vs. actual hit rate (shown to teams as a label on every signal):

| Source label | Stated | Signals | Accurate | Hit rate |
|---|---|---:|---:|---:|
| Market chatter | Low | 8 | 0 | 0% |
| Industry contact | Medium | 12 | 9 | 75% |
| Analyst research | Medium-high | 10 | 8 | 80% |
