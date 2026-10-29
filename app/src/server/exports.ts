import type { Market } from "../engine/market";
import type { Command } from "../engine/types";
import { MM_ID } from "../engine/types";
import { rankTeams } from "../engine/valuation";

const money = (c: number) => (c / 100).toFixed(2);
const iso = (ts: number) => new Date(ts).toISOString();

function csv(rows: (string | number | boolean | null | undefined)[][]) {
  return rows
    .map((r) =>
      r
        .map((v) => {
          const s = v === null || v === undefined ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n") + "\n";
}

/** Organiser exports (results verifier / post-event debrief). Returns null for an unknown kind. */
export async function exportCsv(m: Market, kind: string, loadCommands: () => Promise<Command[]>): Promise<string | null> {
  const name = (id: string) => (id === MM_ID ? "Market maker" : m.teamById.get(id)?.name ?? id);
  switch (kind) {
    case "results": {
      const rows = rankTeams(m.teams, m.accounts, m.rv, m.params.startingCapital * 100);
      return csv([
        ["rank", "team", "team_number", "equity", "return_pct", "realised_pnl", "max_drawdown_pct", "cash", "forecast_score"],
        ...rows.map((r) => [r.rank, r.teamName, r.teamNumber, money(r.equity), r.returnPct, money(r.realized), r.maxDrawdownPct, money(r.cash), r.forecastScore]),
      ]);
    }
    case "rounds": {
      const out: (string | number)[][] = [["round", "team", "rank", "equity", "cash", "holdings_value", "realised", "unrealised"]];
      for (const t of m.teams) for (const s of m.accounts.get(t.id)!.snapshots) out.push([s.round, t.name, m.summaries[s.round - 1]?.leaderboard.find((r) => r.teamId === t.id)?.rank ?? "", money(s.equity), money(s.cash), money(s.holdingsValue), money(s.realized), money(s.unrealized)]);
      return csv(out);
    }
    case "reference-values": {
      const out: (string | number | null)[][] = [["round", "ticker", "rv_start", "rv_end", "vwap", "volume"]];
      for (const s of m.summaries) for (const t of m.tickers) out.push([s.round, t, money(s.rvStart[t]), money(s.rvEnd[t]), s.vwap[t] === null ? null : money(s.vwap[t]!), s.volume[t]]);
      return csv(out);
    }
    case "trades":
      return csv([
        ["id", "round", "time", "ticker", "price", "qty", "buyer", "seller", "aggressor", "voided"],
        ...m.trades.map((t) => [t.id, t.round, iso(t.ts), t.ticker, money(t.price), t.qty, name(t.buyTeamId), name(t.sellTeamId), t.aggressor, !!t.voided]),
      ]);
    case "orders":
      return csv([
        ["id", "round", "time", "team", "ticker", "side", "type", "price", "qty", "filled", "status"],
        ...[...m.orders.values()].map((o) => [o.id, o.round, iso(o.ts), name(o.teamId), o.ticker, o.side, o.type, money(o.price), o.qty, o.filled, o.status]),
      ]);
    case "teams":
      return csv([["number", "name", "code", "intel_group"], ...m.teams.map((t) => [t.number, t.name, t.code, t.group])]);
    case "audit":
      return csv([["seq", "time", "actor", "action", "detail"], ...m.audit.map((a) => [a.seq, iso(a.ts), a.actor, a.action, a.detail])]);
    case "commands":
      return (await loadCommands()).map((c) => JSON.stringify(c)).join("\n") + "\n";
    default:
      return null;
  }
}
