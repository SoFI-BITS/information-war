"use client";
import type { PublicStock } from "@/engine/views";
import { change, money, pct, tone } from "@/lib/format";
import { Sparkline } from "./Watchlist";

/** Reference value per round (bars) with this round's trade prices (line). */
function RvChart({ stock }: { stock: PublicStock }) {
  const W = 420;
  const H = 120;
  const vals = [...stock.history, ...stock.recentPrices];
  const min = Math.min(...vals) * 0.98;
  const max = Math.max(...vals) * 1.02;
  const y = (v: number) => H - 16 - ((v - min) / (max - min || 1)) * (H - 24);
  const n = stock.history.length;
  const bw = Math.min(28, (W * 0.6) / Math.max(n, 1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" role="img" aria-label={`${stock.ticker} reference value history`}>
      {stock.history.map((v, i) => {
        const x = 8 + i * (bw + 4);
        const prev = stock.history[i - 1] ?? v;
        return (
          <g key={i}>
            <rect x={x} y={y(v)} width={bw} height={H - 16 - y(v)} rx="2" fill={v >= prev ? "var(--color-up)" : "var(--color-down)"} opacity={i === n - 1 ? 0.9 : 0.45} />
            <text x={x + bw / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-muted)">
              {i === 0 ? "Open" : `R${i}`}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${8 + n * (bw + 4) + 8},0)`}>
        {stock.recentPrices.length > 1 && (
          <polyline
            fill="none"
            stroke="var(--color-info)"
            strokeWidth="1.5"
            points={stock.recentPrices.map((p, i) => `${(i / (stock.recentPrices.length - 1)) * (W - (8 + n * (bw + 4) + 20))},${y(p)}`).join(" ")}
          />
        )}
        <text x="0" y="10" fontSize="9" fill="var(--color-info)">
          recent trades
        </text>
      </g>
    </svg>
  );
}

export function StockDetail({ stock }: { stock: PublicStock }) {
  const d = change(stock.rv, stock.rvPrev);
  const total = change(stock.rv, stock.startPrice);
  return (
    <section className="panel p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">
            {stock.ticker} <span className="text-sm font-medium text-muted">{stock.name}</span>
          </h2>
          <p className="text-xs text-muted">
            {stock.sector} · Volatility: <span className="text-accent">{stock.volatility}</span>
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <div className="text-[10px] text-muted uppercase">Reference value</div>
            <div className="num text-xl font-semibold">{money(stock.rv)}</div>
            <div className={`num text-xs ${tone(d)}`}>{pct(d)} last round</div>
          </div>
          <div>
            <div className="text-[10px] text-muted uppercase">Last traded</div>
            <div className="num text-xl text-muted">{money(stock.lastPrice)}</div>
            <div className="num text-xs text-muted">vol {stock.roundVolume.toLocaleString()} this round</div>
          </div>
          <div className="hidden md:block">
            <div className="text-[10px] text-muted uppercase">Since start</div>
            <div className={`num text-xl ${tone(total)}`}>{pct(total, 1)}</div>
            <div className="num text-xs text-muted">from {money(stock.startPrice)}</div>
          </div>
        </div>
      </div>
      <RvChart stock={stock} />
      <p className="text-xs text-muted">
        {stock.description} <span className="text-text/70">Links: {stock.links}</span>
      </p>
    </section>
  );
}

export { Sparkline };
