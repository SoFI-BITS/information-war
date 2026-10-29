"use client";
import { useState } from "react";
import type { PublicView, TeamView } from "@/engine/views";
import { money, signedMoney, time, tone } from "@/lib/format";
import type { Ack } from "@/lib/useMarket";

type Tab = "holdings" | "orders" | "fills" | "history";

export function Portfolio({ team, pub, emit, onSelect }: { team: TeamView; pub: PublicView; emit: (e: string, p: unknown) => Promise<Ack>; onSelect: (t: string) => void }) {
  const [tab, setTab] = useState<Tab>("holdings");
  const [editing, setEditing] = useState<{ id: string; price: string; qty: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const trading = pub.phase === "TRADING" && !pub.paused;

  async function act(payload: unknown) {
    setErr(null);
    const res = await emit("cmd", payload);
    if (!res.ok) setErr(res.error ?? "Rejected");
    return res.ok;
  }

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)} className={`px-2 py-1 ${tab === t ? "text-text" : "text-muted hover:text-text"}`}>
      {label}
    </button>
  );

  return (
    <section className="panel flex min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-1 text-[11px] font-semibold tracking-wider uppercase">
        {tabBtn("holdings", "Holdings")}
        {tabBtn("orders", `Open orders (${team.openOrders.length})`)}
        {tabBtn("fills", "My trades")}
        {tabBtn("history", "Round history")}
        {err && <span className="ml-auto truncate px-2 text-[11px] normal-case tracking-normal text-down">{err}</span>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto text-xs">
        {tab === "holdings" && (
          <table className="w-full">
            <thead className="text-[10px] text-muted uppercase">
              <tr>
                {["Stock", "Shares", "Avg cost", "RV", "Value", "Unrealised", "Realised"].map((h, i) => (
                  <th key={h} className={`px-2 py-1 ${i ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.positions.map((p) => {
                const s = pub.stocks.find((x) => x.ticker === p.ticker)!;
                return (
                  <tr key={p.ticker} onClick={() => onSelect(p.ticker)} className="cursor-pointer border-t border-line/50 hover:bg-panel-2">
                    <td className="px-2 py-1 font-semibold">
                      {p.ticker}
                      {p.reservedShares > 0 && <span className="ml-1 text-[10px] text-muted">({p.reservedShares} in orders)</span>}
                    </td>
                    <td className="num px-2 text-right">{p.shares}</td>
                    <td className="num px-2 text-right">{p.shares ? money(p.avgCost) : "—"}</td>
                    <td className="num px-2 text-right">{money(s.rv)}</td>
                    <td className="num px-2 text-right">{money(p.value)}</td>
                    <td className={`num px-2 text-right ${tone(p.unrealized)}`}>{p.shares ? signedMoney(p.unrealized) : "—"}</td>
                    <td className={`num px-2 text-right ${tone(p.realized)}`}>{p.realized ? signedMoney(p.realized) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {tab === "orders" &&
          (team.openOrders.length === 0 ? (
            <p className="p-3 text-muted">No open orders. Resting orders are cancelled automatically when each round closes.</p>
          ) : (
            <table className="w-full">
              <thead className="text-[10px] text-muted uppercase">
                <tr>
                  {["Time", "Stock", "Side", "Price", "Remaining", "Filled", ""].map((h, i) => (
                    <th key={i} className={`px-2 py-1 ${i > 2 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.openOrders.map((o) =>
                  editing?.id === o.id ? (
                    <tr key={o.id} className="border-t border-line/50 bg-panel-2">
                      <td className="px-2" colSpan={3}>
                        Modify {o.side} {o.ticker} <span className="text-muted">(price change or larger size loses queue priority)</span>
                      </td>
                      <td className="px-1">
                        <input className="input py-0.5 text-right" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
                      </td>
                      <td className="px-1">
                        <input className="input py-0.5 text-right" value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} />
                      </td>
                      <td colSpan={2} className="px-2 text-right whitespace-nowrap">
                        <button
                          className="text-info hover:underline"
                          onClick={async () => {
                            const price = Number(editing.price);
                            const qty = Number(editing.qty);
                            const ok = await act({ type: "MODIFY_ORDER", orderId: o.id, price: Math.round(price * 100) !== o.price ? price : undefined, qty: qty !== o.remaining ? qty : undefined });
                            if (ok) setEditing(null);
                          }}
                        >
                          Save
                        </button>
                        <button className="ml-2 text-muted hover:underline" onClick={() => setEditing(null)}>
                          Close
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={o.id} className="border-t border-line/50">
                      <td className="num px-2 py-1 text-muted">{time(o.ts)}</td>
                      <td className="px-2 font-semibold">{o.ticker}</td>
                      <td className={`px-2 ${o.side === "BUY" ? "text-up" : "text-down"}`}>{o.side}</td>
                      <td className="num px-2 text-right">{money(o.price)}</td>
                      <td className="num px-2 text-right">{o.remaining}</td>
                      <td className="num px-2 text-right">{o.filled}</td>
                      <td className="px-2 text-right whitespace-nowrap">
                        <button disabled={!trading} className="text-info hover:underline disabled:opacity-40" onClick={() => setEditing({ id: o.id, price: (o.price / 100).toFixed(2), qty: String(o.remaining) })}>
                          Modify
                        </button>
                        <button disabled={!trading} className="ml-2 text-down hover:underline disabled:opacity-40" onClick={() => act({ type: "CANCEL_ORDER", orderId: o.id })}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          ))}
        {tab === "fills" &&
          (team.fills.length === 0 ? (
            <p className="p-3 text-muted">No executed trades yet.</p>
          ) : (
            <table className="w-full">
              <tbody>
                {team.fills.map((f, i) => (
                  <tr key={i} className="border-t border-line/50">
                    <td className="num px-2 py-1 text-muted">R{f.round} {time(f.ts)}</td>
                    <td className="px-2 font-semibold">{f.ticker}</td>
                    <td className={`px-2 ${f.side === "BUY" ? "text-up" : "text-down"}`}>{f.side === "BUY" ? "Bought" : "Sold"}</td>
                    <td className="num px-2 text-right">{f.qty}</td>
                    <td className="num px-2 text-right">@ {money(f.price)}</td>
                    <td className="num px-2 text-right text-muted">{money(f.qty * f.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        {tab === "history" &&
          (team.history.length === 0 ? (
            <p className="p-3 text-muted">Round results appear here after each round settles.</p>
          ) : (
            <table className="w-full">
              <thead className="text-[10px] text-muted uppercase">
                <tr>
                  {["Round", "Equity", "Change", "Cash", "Holdings", "Rank"].map((h, i) => (
                    <th key={h} className={`px-2 py-1 ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.history.map((h, i) => {
                  const prev = i ? team.history[i - 1].equity : team.startingCapital;
                  return (
                    <tr key={h.round} className="border-t border-line/50">
                      <td className="px-2 py-1">R{h.round}</td>
                      <td className="num px-2 text-right">{money(h.equity)}</td>
                      <td className={`num px-2 text-right ${tone(h.equity - prev)}`}>{signedMoney(h.equity - prev)}</td>
                      <td className="num px-2 text-right">{money(h.cash)}</td>
                      <td className="num px-2 text-right">{money(h.holdingsValue)}</td>
                      <td className="num px-2 text-right">{i === team.history.length - 1 ? team.rank ?? "—" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
      </div>
    </section>
  );
}
