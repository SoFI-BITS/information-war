"use client";
import type { PublicStock } from "@/engine/views";
import { money } from "@/lib/format";

/** Anonymous, aggregated depth. Click a level to copy its price into the ticket. */
export function OrderBookPanel({ stock, onPick }: { stock: PublicStock; onPick: (price: number) => void }) {
  const maxQty = Math.max(1, ...stock.bids.map((l) => l.qty), ...stock.asks.map((l) => l.qty));
  const spread = stock.asks[0] && stock.bids[0] ? stock.asks[0].price - stock.bids[0].price : null;
  const Row = ({ price, qty, orders, side }: { price: number; qty: number; orders: number; side: "bid" | "ask" }) => (
    <button onClick={() => onPick(price)} className="relative grid w-full grid-cols-3 px-2 py-[3px] text-xs hover:bg-panel-2">
      <span className="absolute inset-y-0 right-0" style={{ width: `${(qty / maxQty) * 100}%`, background: side === "bid" ? "rgba(47,191,113,.12)" : "rgba(239,83,80,.12)" }} />
      <span className={`num relative text-left ${side === "bid" ? "text-up" : "text-down"}`}>{money(price)}</span>
      <span className="num relative text-right">{qty.toLocaleString()}</span>
      <span className="num relative text-right text-muted">{orders}</span>
    </button>
  );
  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="panel-title">
        <span>Order book · {stock.ticker}</span>
        <span className="normal-case tracking-normal">anonymous</span>
      </div>
      <div className="grid grid-cols-3 px-2 pt-1 text-[10px] text-muted uppercase">
        <span>Price</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Orders</span>
      </div>
      <div className="flex flex-col-reverse">
        {stock.asks.map((l) => (
          <Row key={`a${l.price}`} {...l} side="ask" />
        ))}
      </div>
      <div className="num border-y border-line bg-bg px-2 py-1 text-center text-[11px] text-muted">
        {spread === null ? "one-sided or empty book" : `spread ${money(spread)} · RV ${money(stock.rv)}`}
      </div>
      <div>
        {stock.bids.map((l) => (
          <Row key={`b${l.price}`} {...l} side="bid" />
        ))}
      </div>
      {!stock.asks.length && !stock.bids.length && <p className="p-3 text-center text-xs text-muted">No orders. The book opens when trading starts.</p>}
    </section>
  );
}
