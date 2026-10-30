# The Information War — Participant Rulebook

*Make the rules clear. Make the information uncertain. Make the consequences matter.*

## 1. Your objective

Finish Round 10 with the **highest portfolio equity**. Every team starts with exactly **100,000 credits**: a holding worth about 4,000 credits in each of the ten stocks, plus cash (about 60,000). The ten companies are fictional. Real-world news cannot help you.

**Equity = cash + sum of (shares held x reference value)**. Return % = (equity - starting capital) / starting capital.

## 2. How a round works

| Phase | Length | What happens |
|---|---|---|
| News | 20 s | Public news is released to everyone. Your team may also receive private intelligence. |
| Trading | 3:20 | Place, modify and cancel orders. Trades execute in the central order book. |
| Settlement | 20 s | Trading stops. All open orders are cancelled, reference values are published and portfolios are marked. |

There are 10 rounds of 4 minutes each. The server clock controls everything; the countdown on your screen is the official time. Orders cannot be placed, edited or cancelled after the cutoff.

## 3. Two prices: do not confuse them

**Last traded price**: the price of the most recent actual trade. It is a fact about one trade, not proof you could sell everything at that price.

**Reference value (RV)**: the official end-of-round valuation used to score *every* team. It follows each company's hidden economic fundamentals, plus a small, capped pull toward the round's traded prices: RV = F + 0.3 x (VWAP - F), with the pull capped at 6% of F (so trading can move RV by at most 1.8%). The pull only applies if the round had at least 150 shares traded in 5+ trades involving 3+ different teams. One small trade at an extreme price cannot change your score. Unfilled orders never affect RV.

## 4. Orders

- **Limit order**: buy at or below your price, or sell at or above it. Any unfilled part rests in the book until filled, cancelled, or the round ends.
- **Market order**: executes immediately against resting orders at the best available prices, but only within 3% of the best price at the moment you submit. Anything not filled at once is cancelled. Execution is not guaranteed; the ticket tells you whether you were fully filled, partially filled or unfilled.
- **Modify**: reducing quantity keeps your place in the queue. Changing the price or increasing quantity sends the order to the back of the queue (it may also trade immediately).
- **Cancel**: removes the unfilled part of a resting order.
- **Matching**: best price first; at the same price, the earliest order first. Trades execute at the resting order's price.
- **Self-trades**: if your new order would trade with your own resting order, your resting order is cancelled instead.

## 5. Limits (identical for every team)

- No short selling, no borrowing, no leverage. You can only sell shares you own, and only buy with cash you have. Open orders reserve the cash or shares they need.
- Maximum buy order value: 25,000 credits per order. Sell orders have no value limit, and there is no limit on total trading in a round. Maximum open orders: 25.
- Position limit: up to 30,000 credits per stock at its starting price (shown as a share limit in the terminal; includes open buy orders).
- Limit prices must be within ±25% of the stock's reference value at the start of the round.
- Up to 20 order actions per 10 seconds. Double clicks are recognised and executed only once.

## 6. Liquidity: the market maker

An automated, rule-based market maker always quotes in every stock so you can trade even when other teams are not. Each round it quotes 3 price levels on each side, starting 1.0% either side of a mid price, each level worth about 6,000 credits. Its mid starts at the round's opening RV and moves 1.0% for every 10,000 credits that teams net-buy from it (or down when they sell), up to ±8%. It does not know the future and cannot be identified in the book. **Pre-announced: in Round 7, liquidity is reduced** (spread 3.0%, 2 levels of 2,500 credits, moves 2.0% per 10,000). Market orders may fill at worse prices or only partly.

## 7. Information

- **Public news**: the same bulletin for all teams each round. It can be ambiguous; work out who wins and who loses.
- **Private intelligence**: your team may receive signals others do not. Each shows its source (Market chatter / Industry contact / Analyst research) and a stated reliability. Signals may be accurate, incomplete, outdated or misleading. Signals are allocated by a fixed plan prepared before the event.
- **Research credits**: 3 for the whole event, separate from cash. Spend 1 credit to buy a verification item (second source, supply-chain check, extra indicator). Research reduces uncertainty; it never reveals future prices.
- **Order book and trade tape**: anonymous. You can see resting orders and executed trades, never who placed them. A big order may be conviction, a hedge, a mistake or a bluff.

## 8. Forecasts (separate award)

Before Rounds 3, 6, 9 you may predict whether one named stock's RV will finish the round higher or lower. Forecasts lock when trading opens and score 1 point each if correct. Forecast points decide the Best Forecaster award only; they never change equity or rank.

## 9. Winning and tie-breaks

Final ranking is by equity after Round 10 settles. Ties are broken by: (1) higher realised profit from completed trades, (2) lower maximum drawdown (largest fall from a peak in round-end equity), (3) higher cash.

## 10. Fair play

- One device and one active session per team. No communication with other teams during trading. Trade only through your own account.
- Do not exploit software bugs or try to access data outside your interface; report bugs to technical support.
- The scenario, signal plan and rules are locked before Round 1 and are the same for everyone. Organisers never change outcomes during the event; every administrative action is logged.
- Technical problems: the organiser may pause the market (the clock stops). If a failure makes a round unreliable, that round may be voided and replayed from its starting positions. After a server restart the market is paused and resumes with at least 30 seconds remaining.
- Aggressive, contrarian and clever trading within these rules is encouraged.

## 11. The ten stocks

| Ticker | Company | Sector | Start | Volatility | Known links |
|---|---|---|---|---|---|
| NVTX | Novatex Devices | Consumer technology | 142 | Very high | Buys components from Forgeline. Sensitive to interest rates (growth stock). |
| HBFG | Harbourline Financial Group | Banking and financial services | 88 | High | Earns more when interest rates rise. Lends to Solaris Ridge and Tidewell. |
| PTRL | Petralis Energy | Energy | 74 | High | Competes with renewables for energy policy. Exports priced in foreign currency. |
| CLVH | Calvera Health | Healthcare | 126 | Very high | Value depends heavily on VX-7 regulatory outcome and competitors. |
| MRLW | Marlowe & Kent | Retail and consumer goods | 64 | High | Imports most holiday stock through the Port of Ashmouth. Sensitive to consumer spending. |
| FRGE | Forgeline Industries | Industrial manufacturing | 96 | High | Supplies Novatex and the wind-turbine industry. Depends on imported bearings. |
| TDWL | Tidewell Logistics | Logistics and shipping | 68 | High | Fuel is a major cost. Moves goods for Marlowe & Kent and Greenfield. |
| ARCM | Arcwave Communications | Telecommunications | 82 | High | Debt-heavy, so sensitive to interest rates. Bidding in the 6G spectrum auction. |
| GRNF | Greenfield Harvest Foods | Agriculture and food | 61 | High | Exports via the Port of Ashmouth. Harvest yields drive annual results. |
| SLRD | Solaris Ridge Renewables | Renewable infrastructure | 110 | Very high | Depends on government subsidy policy and interest rates. Buys gearboxes from Forgeline. |

Typical round-to-round RV moves are within ±10%; 'Very high' stocks can move ±20% on a major event.

## 12. The terminal at a glance

- **Top bar**: round, phase and countdown; your equity, return, available cash (cash not reserved by open orders) and rank after the last round.
- **Watchlist** (left): RV, last trade and RV change for each stock. Click a stock to load it. Public news is below.
- **Centre**: the stock's RV history, the anonymous order book (click a price to copy it into the ticket), the order ticket, and tabs for Holdings, Open orders (modify / cancel), My trades and Round history.
- **Right**: your private intelligence, research purchases, the forecast question and the anonymous trade tape.
- If your screen says *reconnecting*, wait: the terminal restores itself. If you are signed out, ask technical support; staff never give trading advice.
