# Phase 4: Core Engine Specification

Code: [`app/src/engine/`](../../app/src/engine/). Tests: `npm test` (21 tests). Calibration: `npm run simulate` writes [`calibration-report.md`](calibration-report.md).

## 1. Central limit order book (`orderbook.ts`)

- One book per stock. **Bids** are sorted by highest price, then lowest `seq`. **Asks** are sorted by lowest price, then lowest `seq`. `seq` is a global counter that sets time priority.
- **Matching:** while the incoming order has remaining quantity and the best opposite order *crosses* (bid ≥ ask), fill `min(incoming.remaining, resting.remaining)` **at the resting order's price**. Fully filled resting orders leave the book; partially filled ones keep their place.
- **Self-trade prevention:** if the best opposite order belongs to the same team, that resting order is cancelled and matching continues.
- **Depth view:** orders are aggregated by price level (price, total quantity, number of orders), 8 levels per side.

## 2. Order lifecycle (`market.ts`)

| Step | Rule |
|---|---|
| Accept | Phase is TRADING and not paused · stock exists · whole-share quantity · price in cents |
| Idempotency | A repeated `clientOrderId` returns the original result with no change |
| Limit price band | ±25% of the round's opening RV |
| Market order | IOC. Its limit is the *collar*: best opposite price × (1 ± 3%). The unfilled remainder is cancelled. With an empty opposite side the order is UNFILLED and nothing changes. |
| Notional | buy orders: qty × (limit or collar) ≤ 25,000 credits; sell orders uncapped |
| Buy checks | qty × price ≤ cash − reserved cash · shares + open buy qty + qty ≤ share cap |
| Sell checks | qty ≤ shares − shares reserved by open sells (no shorting) |
| Reserve | A buy reserves qty × limit cash. A sell reserves qty shares. |
| Fill | Buyer: cash −= px×q, reserve −= limit×q, average cost re-weighted. Seller: cash += px×q, reserved shares −= q, realised += (px − avg)×q |
| Modify | A pure quantity decrease keeps `seq`. A price change or quantity increase means cancel-and-replace: new `seq`, may trade immediately. |
| Cancel / close | Release the remaining reservation |
| Rate limit | 20 accepted actions per 10 s per team |

## 3. Market maker (disclosed rule)

mid = RV<sub>open</sub> × (1 + clamp(netTeamBuyCredits / 10,000 × skew%, ±maxSkew%))

There are `levels` asks and bids at mid × (1 ± (halfSpread + i × step)), each worth `levelNotional`. The maker re-quotes after every command that filled against it. Its trades count toward VWAP. Its inventory isn't scored. The Round 7 override widens the spread and thins depth.

Why this can't be exploited: a round trip (buy, push the mid up, then sell) always pays at least the full spread, because the skew per 10,000 credits (1%) is no larger than the half-spread (1%) plus the level steps. The `pumpAndDump` probe in the calibration loses money in every run.

## 4. End-of-round settlement

1. Set phase SETTLING and stop accepting orders.
2. Cancel every open order (team and market maker) and release all reservations.
3. For each stock: F ← F × (1 + scripted %). Compute the VWAP of the round's non-voided trades.
4. RV = F + 0.3 × clamp(VWAP − F, ±6% × F), applied **only if** volume ≥ 150 shares, trades ≥ 5 and distinct teams ≥ 3. Otherwise RV = F. Round to cents.
5. Mark every account to the same RV: equity = cash + Σ shares × RV. Snapshot it and update max drawdown.
6. Score the forecast (if this round has one): correct when the sign of RV<sub>end</sub> − RV<sub>start</sub> matches. This is separate from equity.
7. Rank by equity, then realised P&L, then lower max drawdown, then cash, then team number.
8. Publish the round summary and project it to the DB (snapshots, holdings, REFERENCE_VALUE events).

## 5. Operations commands

- **PAUSE / RESUME:** freezes the remaining time. At least 30 s remain on resume.
- **RESTART_ROUND (void):** restores the account snapshot taken at the round's start. Research already bought is kept. Round trades are marked `voided` and excluded from VWAP and the tape. The round restarts from its news phase. The reason is logged.
- **TERMINATE:** voids an in-progress round and finishes with standings from the last settled round.
- **REVEAL_DEBRIEF:** after the event, adds the hidden scenario to the public view.

## 6. Verified properties (tests)

Price-time priority and resting-price execution · IOC + collar + partial-fill reporting · unfilled market order changes nothing · self-trade prevention · cash reservation prevents overspend · no shorting via multiple orders · position cap includes open buys · price band and notional cap · no trading outside the TRADING phase · idempotent `clientOrderId` · rate limit · modify keeps or loses priority correctly · settlement cancels orders and releases reservations · a tiny extreme-price trade can't move RV · market influence capped at 1.8% · tie-breakers · forecasts scored separately · void restores exact state · **deterministic replay** · the public view leaks no identities · market-maker quotes and skew.
