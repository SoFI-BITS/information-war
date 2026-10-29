import { readFileSync } from "node:fs";
import path from "node:path";
import type { Scenario } from "../engine/types";

export const DEFAULT_SCENARIO_PATH = path.resolve(__dirname, "scenario.json");

/** Load and sanity-check the locked event configuration. Throws on any inconsistency. */
export function loadScenario(file = process.env.SCENARIO_PATH || DEFAULT_SCENARIO_PATH): Scenario {
  const scn = JSON.parse(readFileSync(file, "utf8")) as Scenario;
  const tickers = scn.stocks.map((s) => s.ticker);
  const errors: string[] = [];
  if (scn.rounds.length !== scn.params.rounds) errors.push(`params.rounds=${scn.params.rounds} but ${scn.rounds.length} rounds defined`);
  if (new Set(tickers).size !== tickers.length) errors.push("duplicate tickers");
  for (const r of scn.rounds) {
    for (const t of tickers) if (typeof r.fundamentals[t] !== "number") errors.push(`round ${r.round}: missing fundamental for ${t}`);
    for (const s of r.signals) {
      if (!tickers.includes(s.ticker)) errors.push(`${s.id}: unknown ticker ${s.ticker}`);
      if (!s.groups?.length) errors.push(`${s.id}: no groups assigned (run tools/balance_signals.py)`);
      if (!scn.sources[s.source]) errors.push(`${s.id}: unknown source ${s.source}`);
    }
    if (r.forecast && !tickers.includes(r.forecast.ticker)) errors.push(`round ${r.round}: forecast ticker unknown`);
  }
  if (errors.length) throw new Error(`Invalid scenario:\n- ${errors.join("\n- ")}`);
  return scn;
}
