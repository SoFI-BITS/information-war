"use client";
import type { PublicStock } from "@/engine/views";
import { change, money, pct, tone } from "@/lib/format";

export function Sparkline({ values, width = 64, height = 20, stroke }: { values: number[]; width?: number; height?: number; stroke?: string }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} aria-hidden>
      <polyline points={pts} fill="none" stroke={stroke ?? (up ? "var(--color-up)" : "var(--color-down)")} strokeWidth="1.5" />
    </svg>
  );
}

export function Watchlist({ stocks, selected, onSelect, holdings }: { stocks: PublicStock[]; selected: string; onSelect: (t: string) => void; holdings: Record<string, number> }) {
  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-title">
        <span>Watchlist</span>
        <span className="normal-case tracking-normal" title="Reference value: the price your portfolio is scored at">RV = scoring value</span>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] text-muted uppercase">
            <tr>
              <th className="px-2 py-1 text-left">Stock</th>
              <th className="px-2 py-1 text-right">RV</th>
              <th className="px-2 py-1 text-right">Last</th>
              <th className="px-2 py-1 text-right">RV Δ</th>
              <th className="px-1 py-1" />
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => {
              const d = change(s.rv, s.rvPrev);
              return (
                <tr key={s.ticker} onClick={() => onSelect(s.ticker)} className={`cursor-pointer border-t border-line/60 hover:bg-panel-2 ${selected === s.ticker ? "bg-panel-2" : ""}`}>
                  <td className="px-2 py-1.5">
                    <div className="font-semibold">
                      {s.ticker}
                      {holdings[s.ticker] ? <span className="ml-1 text-[10px] text-info">{holdings[s.ticker]}</span> : null}
                    </div>
                    <div className="max-w-28 truncate text-[10px] text-muted">{s.name}</div>
                  </td>
                  <td className="num px-2 text-right">{money(s.rv)}</td>
                  <td className="num px-2 text-right text-muted">{money(s.lastPrice)}</td>
                  <td className={`num px-2 text-right ${tone(d)}`}>{pct(d, 1)}</td>
                  <td className="px-1">
                    <Sparkline values={s.history} width={48} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
