import type { Account, LeaderboardRow, ScenarioParams, Snapshot, Team, Trade } from "./types";
import { MM_ID } from "./types";

export interface RvResult {
  rv: number;
  vwap: number | null;
  volume: number;
  trades: number;
  distinctTeams: number;
  /** Whether market activity met the thresholds and was allowed to influence RV. */
  marketInfluence: boolean;
}

/**
 * Reference value (published end-of-round mark), in cents.
 *
 *   RV = F + w × clamp(VWAP − F, −cap × F, +cap × F)
 *
 * F is the hidden fundamental value after this round's scripted event. VWAP is
 * the volume-weighted price of all non-voided trades in the round. Market
 * influence only applies when the round had enough volume, trades and distinct
 * teams, so one tiny trade cannot move the mark at all, and even heavy trading
 * can move it by at most w × cap (0.3 × 6% = 1.8%).
 */
export function referenceValue(fundamental: number, roundTrades: Trade[], p: ScenarioParams["referenceValue"]): RvResult {
  const live = roundTrades.filter((t) => !t.voided);
  const volume = live.reduce((s, t) => s + t.qty, 0);
  const teams = new Set<string>();
  for (const t of live) {
    if (t.buyTeamId !== MM_ID) teams.add(t.buyTeamId);
    if (t.sellTeamId !== MM_ID) teams.add(t.sellTeamId);
  }
  const vwap = volume > 0 ? live.reduce((s, t) => s + t.price * t.qty, 0) / volume : null;
  const marketInfluence =
    vwap !== null && volume >= p.minVolumeShares && live.length >= p.minTrades && teams.size >= p.minDistinctTeams;
  let rv = fundamental;
  if (marketInfluence && vwap !== null) {
    const cap = (p.capPct / 100) * fundamental;
    const gap = Math.max(-cap, Math.min(cap, vwap - fundamental));
    rv = fundamental + p.weight * gap;
  }
  return {
    rv: Math.max(1, Math.round(rv)),
    vwap: vwap === null ? null : Math.round(vwap),
    volume,
    trades: live.length,
    distinctTeams: teams.size,
    marketInfluence,
  };
}

/** Mark an account to the given reference values. */
export function markToMarket(acc: Account, rv: Record<string, number>, round: number): Snapshot {
  let holdingsValue = 0;
  let realized = 0;
  let unrealized = 0;
  for (const [ticker, pos] of Object.entries(acc.positions)) {
    const px = rv[ticker];
    holdingsValue += pos.shares * px;
    realized += pos.realized;
    unrealized += pos.shares * (px - pos.avgCost);
  }
  return {
    round,
    cash: acc.cash,
    holdingsValue,
    equity: acc.cash + holdingsValue,
    realized: Math.round(realized),
    unrealized: Math.round(unrealized),
  };
}

/** Maximum peak-to-trough decline (%) over the starting capital and all round-end equities. */
export function maxDrawdownPct(startingCapital: number, equities: number[]): number {
  let peak = startingCapital;
  let worst = 0;
  for (const e of equities) {
    peak = Math.max(peak, e);
    worst = Math.max(worst, (peak - e) / peak);
  }
  return Math.round(worst * 10000) / 100;
}

/**
 * Rank by equity. Tie-breakers (published): higher realised P&L, lower max
 * drawdown, higher cash, then team number so the order is always total.
 */
export function rankTeams(teams: Team[], accounts: Map<string, Account>, rv: Record<string, number>, startingCapital: number): LeaderboardRow[] {
  const rows = teams.map((t) => {
    const acc = accounts.get(t.id)!;
    const snap = markToMarket(acc, rv, 0);
    return {
      rank: 0,
      teamId: t.id,
      teamName: t.name,
      teamNumber: t.number,
      equity: snap.equity,
      returnPct: Math.round(((snap.equity - startingCapital) / startingCapital) * 10000) / 100,
      realized: snap.realized,
      maxDrawdownPct: acc.maxDrawdownPct,
      cash: acc.cash,
      forecastScore: acc.forecastScore,
    };
  });
  rows.sort(
    (a, b) =>
      b.equity - a.equity ||
      b.realized - a.realized ||
      a.maxDrawdownPct - b.maxDrawdownPct ||
      b.cash - a.cash ||
      a.teamNumber - b.teamNumber,
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
