"use client";
import type { PublicStock } from "@/engine/views";
import { money } from "@/lib/format";

/** Key facts, revenue mix and open questions for one company. */
export function ProfileFacts({ stock, compact = false }: { stock: PublicStock; compact?: boolean }) {
  const p = stock.profile;
  if (!p) return null;
  const facts: [string, string][] = [
    ["Founded", String(p.founded)],
    ["HQ", p.headquarters],
    ["Employees", p.employees],
    ["Revenue", p.revenue],
    ["Margin", p.margin],
    ["Debt", p.debt],
    ["Dividend", p.dividend],
  ];
  return (
    <div className="space-y-2 text-xs">
      {!compact && <p className="leading-snug">{p.overview}</p>}
      <dl className={`grid gap-x-3 gap-y-0.5 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
        {facts.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 border-b border-line/40 py-0.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <p>
        <span className="text-muted">Revenue mix: </span>
        {p.revenueMix}
      </p>
      <div>
        <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">What analysts watch</p>
        <ul className="list-disc pl-4 text-muted">
          {p.watch.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Every company on one screen: shown during the pre-Round-1 briefing and from the top bar at any time. */
export function CompanyBriefing({ stocks }: { stocks: PublicStock[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {stocks.map((s) => (
        <article key={s.ticker} className="rounded border border-line bg-panel-2/40 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold">
              {s.ticker} <span className="text-sm font-medium text-muted">{s.name}</span>
            </h3>
            <span className="num text-sm">{money(s.rv)}</span>
          </div>
          <p className="mb-2 text-[11px] text-muted">
            {s.sector} · Volatility: <span className="text-accent">{s.volatility}</span>
          </p>
          <ProfileFacts stock={s} />
          <p className="mt-2 text-[11px] text-text/70">Links: {s.links}</p>
        </article>
      ))}
    </div>
  );
}
