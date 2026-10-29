"use client";
import { useState } from "react";
import type { PublicView, TeamView } from "@/engine/views";
import { money, time } from "@/lib/format";
import type { Ack } from "@/lib/useMarket";

export function NewsFeed({ pub }: { pub: PublicView }) {
  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-title">
        <span>Public news</span>
        <span className="normal-case tracking-normal">same for every team</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {pub.news.length === 0 && <p className="text-xs text-muted">The first bulletin is released when Round 1 begins.</p>}
        {pub.news.map((n, i) => (
          <article key={i} className={`rounded border-l-2 px-2 py-1 ${n.round === pub.round ? "border-accent bg-accent/5" : "border-line"}`}>
            <p className="text-[10px] font-semibold text-muted uppercase">Round {n.round}</p>
            <h3 className="text-sm leading-snug font-semibold">{n.headline}</h3>
            <p className="text-xs text-muted">{n.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const RELIABILITY_TONE: Record<string, string> = { Low: "text-down", Medium: "text-accent", "Medium-high": "text-up" };

export function IntelPanel({ pub, team, emit }: { pub: PublicView; team: TeamView; emit: (e: string, p: unknown) => Promise<Ack> }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const bought = new Set(team.research.map((r) => r.id));
  const forecast = pub.forecast;
  const myForecast = forecast ? team.forecasts[forecast.round] : undefined;
  const forecastOpen = forecast && pub.phase !== "TRADING" && pub.phase !== "FINISHED";

  async function run(key: string, payload: unknown) {
    setBusy(key);
    setErr(null);
    const res = await emit("cmd", payload);
    setBusy(null);
    if (!res.ok) setErr(res.error ?? "Rejected");
  }

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-title">
        <span className="text-accent">Private intelligence</span>
        <span className="normal-case tracking-normal">only your team sees this</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {team.signals.length === 0 && <p className="text-xs text-muted">Intelligence arrives at the start of each round. It may be accurate, incomplete, outdated or misleading.</p>}
        {team.signals.map((s, i) => (
          <article key={i} className={`rounded border border-line px-2 py-1.5 ${s.round === pub.round ? "bg-accent/5" : "opacity-70"}`}>
            <div className="flex justify-between text-[10px] uppercase">
              <span className="font-semibold text-muted">
                R{s.round} · {s.ticker}
              </span>
              <span>
                {s.source} · <span className={RELIABILITY_TONE[s.statedReliability] ?? ""}>reliability {s.statedReliability}</span>
              </span>
            </div>
            <p className="text-sm leading-snug">“{s.text}”</p>
          </article>
        ))}

        <div className="border-t border-line pt-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-wider text-muted uppercase">
            <span>Research</span>
            <span className="text-accent normal-case">{team.researchCredits} credit{team.researchCredits === 1 ? "" : "s"} left</span>
          </div>
          {pub.research.length === 0 && <p className="text-xs text-muted">Research actions are offered during each round.</p>}
          {pub.research.map((r) => (
            <div key={r.id} className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span>{r.title}</span>
              <button
                className="btn-ghost shrink-0 px-2 py-0.5 text-xs"
                disabled={bought.has(r.id) || team.researchCredits < 1 || busy === r.id}
                onClick={() => run(r.id, { type: "BUY_RESEARCH", researchId: r.id })}
              >
                {bought.has(r.id) ? "Bought" : `Verify (${r.cost})`}
              </button>
            </div>
          ))}
          {[...team.research].reverse().map((r) => (
            <div key={r.id} className="mt-1 rounded bg-info/10 px-2 py-1 text-xs">
              <p className="font-semibold text-info">
                R{r.round} research: {r.title}
              </p>
              <p>{r.result}</p>
            </div>
          ))}
        </div>

        {forecast && (
          <div className="border-t border-line pt-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted uppercase">Forecast · Round {forecast.round} · {forecast.ticker}</p>
            <p className="text-xs">{forecast.question}</p>
            <div className="mt-1 flex gap-2">
              {(["UP", "DOWN"] as const).map((d) => (
                <button
                  key={d}
                  disabled={!forecastOpen || busy === "fc"}
                  onClick={() => run("fc", { type: "SUBMIT_FORECAST", round: forecast.round, direction: d })}
                  className={`btn flex-1 py-1 text-xs ${myForecast === d ? (d === "UP" ? "bg-up text-black" : "bg-down text-white") : "bg-panel-2 text-muted"}`}
                >
                  {d === "UP" ? "Higher" : "Lower"}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">{forecastOpen ? "Locks when trading opens. Scored separately; does not affect equity." : myForecast ? `Locked: ${myForecast === "UP" ? "Higher" : "Lower"}` : "Locked: no forecast submitted"}</p>
          </div>
        )}
        {err && <p className="text-xs text-down">{err}</p>}
      </div>
    </section>
  );
}

export function TradeTape({ pub }: { pub: PublicView }) {
  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-title">
        <span>Trade tape</span>
        <span className="normal-case tracking-normal">executed trades · anonymous</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {pub.tape.map((t, i) => (
              <tr key={i} className="border-t border-line/40">
                <td className="num px-2 py-0.5 text-muted">{time(t.time)}</td>
                <td className="px-2 font-semibold">{t.ticker}</td>
                <td className="num px-2 text-right">{money(t.price)}</td>
                <td className="num px-2 text-right text-muted">{t.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pub.tape.length === 0 && <p className="p-3 text-xs text-muted">No trades yet.</p>}
      </div>
    </section>
  );
}
