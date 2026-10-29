"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicStock, PublicView, TeamView } from "@/engine/views";
import { money } from "@/lib/format";
import type { Ack } from "@/lib/useMarket";

type Outcome = { outcome: string; filled: number; remaining: number; avgPrice: number | null };

const OUTCOME_TEXT: Record<string, (o: Outcome) => string> = {
  FILLED: (o) => `Fully filled: ${o.filled} @ ${money(o.avgPrice)} avg`,
  PARTIALLY_FILLED: (o) => `Partially filled: ${o.filled} @ ${money(o.avgPrice)} avg. Rest cancelled (market order)`,
  PARTIALLY_FILLED_RESTING: (o) => `Partially filled: ${o.filled} @ ${money(o.avgPrice)}; ${o.remaining} resting in the book`,
  RESTING: (o) => `Order resting in the book: ${o.remaining} shares (not yet a trade)`,
  UNFILLED: () => "Unfilled: no liquidity within the market-order collar. Nothing traded.",
};

export function OrderTicket({ stock, team, pub, emit, pickedPrice }: { stock: PublicStock; team: TeamView; pub: PublicView; emit: (e: string, p: unknown) => Promise<Ack>; pickedPrice: { price: number; n: number } | null }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [type, setType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [qty, setQty] = useState("10");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // One idempotency key per intended order: retries or double clicks reuse it.
  const intent = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    setPrice((stock.rv / 100).toFixed(2));
    setMsg(null);
  }, [stock.ticker]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pickedPrice) setPrice((pickedPrice.price / 100).toFixed(2));
  }, [pickedPrice]);

  const pos = team.positions.find((p) => p.ticker === stock.ticker)!;
  const q = Math.floor(Number(qty) || 0);
  const px = type === "LIMIT" ? Math.round(Number(price) * 100) : (side === "BUY" ? stock.asks[0]?.price : stock.bids[0]?.price) ?? stock.rv;
  const value = q * px;
  const rules = pub.rules as { maxOrderNotional: number; marketOrderCollarPct: number; limitPriceBandPct: number };
  const maxQtyByValue = Math.floor((rules.maxOrderNotional * 100) / Math.max(px, 1));
  const availShares = pos.shares - pos.reservedShares;
  const trading = pub.phase === "TRADING" && !pub.paused;

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await emit("cmd", { type: "PLACE_ORDER", clientOrderId: intent.current, ticker: stock.ticker, side, orderType: type, price: type === "LIMIT" ? Number(price) : undefined, qty: q });
    setBusy(false);
    if (res.ok) {
      intent.current = crypto.randomUUID();
      const o = res.data as Outcome;
      setMsg({ ok: true, text: res.duplicate ? "Already received (duplicate click ignored)." : OUTCOME_TEXT[o.outcome]?.(o) ?? o.outcome });
    } else {
      if (!res.error?.startsWith("No response")) intent.current = crypto.randomUUID();
      setMsg({ ok: false, text: res.error ?? "Rejected" });
    }
  }

  const sideBtn = (s: "BUY" | "SELL") => (
    <button onClick={() => setSide(s)} className={`btn flex-1 ${side === s ? (s === "BUY" ? "bg-up text-black" : "bg-down text-white") : "bg-panel-2 text-muted"}`}>
      {s === "BUY" ? "Buy" : "Sell"}
    </button>
  );

  return (
    <section className="panel flex flex-col">
      <div className="panel-title">
        <span>Order ticket · {stock.ticker}</span>
        <span className="normal-case tracking-normal">no short selling · no leverage</span>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex gap-2">
          {sideBtn("BUY")}
          {sideBtn("SELL")}
        </div>
        <div className="flex gap-1 rounded bg-bg p-1 text-xs">
          {(["LIMIT", "MARKET"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} className={`flex-1 rounded py-1 font-semibold ${type === t ? "bg-panel-2 text-text" : "text-muted"}`}>
              {t === "LIMIT" ? "Limit" : "Market"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-muted uppercase">
            Quantity
            <input className="input mt-0.5" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label className="text-[10px] text-muted uppercase">
            {type === "LIMIT" ? (side === "BUY" ? "Max price" : "Min price") : "Price"}
            <input className="input mt-0.5 disabled:opacity-50" inputMode="decimal" value={type === "LIMIT" ? price : "best available"} disabled={type === "MARKET"} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
          <dt className="text-muted">Est. value</dt>
          <dd className={`num text-right ${value > rules.maxOrderNotional * 100 ? "text-down" : ""}`}>{money(value)}</dd>
          <dt className="text-muted">{side === "BUY" ? "Available cash" : "Available shares"}</dt>
          <dd className="num text-right">{side === "BUY" ? money(team.availableCash) : availShares}</dd>
          <dt className="text-muted">Max per order</dt>
          <dd className="num text-right">
            {money(rules.maxOrderNotional * 100, 0)} (~{maxQtyByValue} sh)
          </dd>
          <dt className="text-muted">Position / limit</dt>
          <dd className="num text-right">
            {pos.shares} / {pos.maxShares}
          </dd>
        </dl>
        <button onClick={submit} disabled={!trading || busy || q < 1} className={`btn w-full ${side === "BUY" ? "bg-up text-black" : "bg-down text-white"}`}>
          {!trading ? "Trading closed" : busy ? "Sending…" : `${side === "BUY" ? "Buy" : "Sell"} ${q || ""} ${stock.ticker} ${type === "MARKET" ? "at market" : `@ ${price}`}`}
        </button>
        {type === "MARKET" && <p className="text-[10px] text-muted">Market orders fill immediately against resting orders up to {rules.marketOrderCollarPct}% from the best price; any rest is cancelled. Execution is not guaranteed.</p>}
        {type === "LIMIT" && <p className="text-[10px] text-muted">Limit prices must be within ±{rules.limitPriceBandPct}% of the round&apos;s opening RV. Unfilled orders are cancelled at round end.</p>}
        {msg && <p className={`rounded px-2 py-1 text-xs ${msg.ok ? "bg-up/10 text-up" : "bg-down/10 text-down"}`}>{msg.text}</p>}
      </div>
    </section>
  );
}
