// Shared engine types. All money is integer cents; all quantities are integer shares.

export type Side = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type Phase = "LOBBY" | "NEWS" | "TRADING" | "SETTLING" | "FINISHED";
export type OrderStatus = "OPEN" | "PARTIAL" | "FILLED" | "CANCELLED" | "UNFILLED";
export type Reliability = "ACCURATE" | "INCOMPLETE" | "OUTDATED" | "MISLEADING";
export type Direction = "UP" | "DOWN";

/** Owner id used for the disclosed, rule-based market maker. Never sent to clients. */
export const MM_ID = "__MM__";

// ---------------------------------------------------------------- scenario (scenario.json)
export interface MarketMakerParams {
  halfSpreadPct: number;
  levelStepPct: number;
  levels: number;
  levelNotional: number;
  skewPctPer10k: number;
  maxSkewPct: number;
}

export interface ScenarioParams {
  startingCapital: number;
  startingCash: number;
  endowmentPerStock: number;
  rounds: number;
  newsSeconds: number;
  tradingSeconds: number;
  settleSeconds: number;
  maxPositionValuePerStock: number;
  maxOrderNotional: number;
  maxOpenOrders: number;
  rateLimit: { count: number; windowSeconds: number };
  marketOrderCollarPct: number;
  limitPriceBandPct: number;
  researchCredits: number;
  groups: string[];
  referenceValue: { weight: number; capPct: number; minVolumeShares: number; minTrades: number; minDistinctTeams: number };
  marketMaker: MarketMakerParams;
  forecastPoints: number;
}

export interface ScenarioStock {
  ticker: string;
  name: string;
  sector: string;
  description: string;
  startPrice: number;
  volatility: string;
  links: string;
}

export interface ScenarioSignal {
  id: string;
  ticker: string;
  source: string;
  reliability: Reliability;
  impliedDirection: 1 | -1;
  targetRound: number;
  text: string;
  truth: string;
  groups: string[];
}

export interface ScenarioRound {
  round: number;
  title: string;
  purpose: string;
  hiddenState: string;
  news: { headline: string; body: string }[];
  fundamentals: Record<string, number>;
  signals: ScenarioSignal[];
  research: { id: string; title: string; result: string }[];
  forecast?: { ticker: string; question: string };
  marketMaker?: MarketMakerParams;
}

export interface Scenario {
  meta: { name: string; version: string; setting: string; currency: string; lockedAt: string | null; note?: string };
  params: ScenarioParams;
  stocks: ScenarioStock[];
  sources: Record<string, { label: string; statedReliability: string }>;
  rounds: ScenarioRound[];
}

// ---------------------------------------------------------------- runtime state
export interface Team {
  id: string;
  number: number;
  name: string;
  code: string;
  group: string;
}

export interface Order {
  id: string;
  teamId: string;
  ticker: string;
  side: Side;
  type: OrderType;
  /** Limit price in cents. For market orders, the collar price. */
  price: number;
  qty: number;
  remaining: number;
  filled: number;
  /** Monotonic priority sequence; lower = earlier. Reassigned when an order loses priority. */
  seq: number;
  ts: number;
  round: number;
  status: OrderStatus;
  clientOrderId?: string;
}

export interface Trade {
  id: string;
  seq: number;
  round: number;
  ticker: string;
  price: number;
  qty: number;
  ts: number;
  buyTeamId: string;
  sellTeamId: string;
  buyOrderId: string;
  sellOrderId: string;
  aggressor: Side;
  voided?: boolean;
}

export interface Position {
  shares: number;
  /** Average cost per share in cents (float to avoid compounding rounding). */
  avgCost: number;
  /** Realised P&L in cents. */
  realized: number;
}

export interface Snapshot {
  round: number;
  cash: number;
  holdingsValue: number;
  equity: number;
  realized: number;
  unrealized: number;
}

export interface Account {
  teamId: string;
  cash: number;
  reservedCash: number;
  positions: Record<string, Position>;
  reservedShares: Record<string, number>;
  researchCredits: number;
  research: string[];
  forecasts: Record<number, Direction>;
  forecastScore: number;
  snapshots: Snapshot[];
  maxDrawdownPct: number;
}

export interface AuditEntry {
  seq: number;
  ts: number;
  actor: string;
  action: string;
  detail: string;
}

export interface LeaderboardRow {
  rank: number;
  teamId: string;
  teamName: string;
  teamNumber: number;
  equity: number;
  returnPct: number;
  realized: number;
  maxDrawdownPct: number;
  cash: number;
  forecastScore: number;
}

export interface RoundSummary {
  round: number;
  rvStart: Record<string, number>;
  rvEnd: Record<string, number>;
  vwap: Record<string, number | null>;
  volume: Record<string, number>;
  trades: number;
  leaderboard: LeaderboardRow[];
}

// ---------------------------------------------------------------- commands
interface Base {
  ts: number;
}
export type Command =
  | (Base & { type: "SETUP_TEAMS"; teams: Omit<Team, "group">[] })
  | (Base & { type: "START" })
  | (Base & { type: "ADVANCE"; actor?: string })
  | (Base & { type: "PAUSE" })
  | (Base & { type: "RESUME" })
  | (Base & { type: "RESTART_ROUND"; reason: string })
  | (Base & { type: "TERMINATE"; reason: string })
  | (Base & { type: "REVEAL_DEBRIEF" })
  | (Base & { type: "ADMIN_AUDIT"; action: string; detail: string })
  | (Base & {
      type: "PLACE_ORDER";
      teamId: string;
      orderId: string;
      clientOrderId?: string;
      ticker: string;
      side: Side;
      orderType: OrderType;
      price?: number;
      qty: number;
    })
  | (Base & { type: "CANCEL_ORDER"; teamId: string; orderId: string })
  | (Base & { type: "MODIFY_ORDER"; teamId: string; orderId: string; price?: number; qty?: number })
  | (Base & { type: "BUY_RESEARCH"; teamId: string; researchId: string })
  | (Base & { type: "SUBMIT_FORECAST"; teamId: string; round: number; direction: Direction });

export interface CommandResult {
  ok: boolean;
  error?: string;
  /** True when an idempotent retry was recognised; nothing changed. */
  duplicate?: boolean;
  data?: unknown;
}

export type EngineEvent =
  | { kind: "ORDER"; order: Order }
  | { kind: "TRADE"; trade: Trade }
  | { kind: "ROUND_STARTED"; round: number; ts: number }
  | { kind: "ROUND_SETTLED"; summary: RoundSummary; snapshots: Record<string, Snapshot>; positions: Record<string, Record<string, Position>> }
  | { kind: "ROUND_VOIDED"; round: number; ts: number }
  | { kind: "RESEARCH"; teamId: string; researchId: string; round: number; ts: number }
  | { kind: "FORECAST"; teamId: string; round: number; ticker: string; direction: Direction; ts: number }
  | { kind: "AUDIT"; entry: AuditEntry }
  | { kind: "TEAMS"; teams: Team[] };
