"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IntelPanel, NewsFeed, TradeTape } from "@/components/terminal/InfoPanels";
import { OrderBookPanel } from "@/components/terminal/OrderBook";
import { OrderTicket } from "@/components/terminal/OrderTicket";
import { PhaseOverlay, TopBar } from "@/components/terminal/Overlays";
import { Portfolio } from "@/components/terminal/Portfolio";
import { StockDetail } from "@/components/terminal/StockDetail";
import { Watchlist } from "@/components/terminal/Watchlist";
import { PHASE_LABEL } from "@/lib/format";
import { safeGet, safeSet, TOKEN_KEY, useCountdown, useMarket } from "@/lib/useMarket";

export default function Terminal() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const t = safeGet(TOKEN_KEY);
    if (!t) router.replace("/");
    setToken(t);
  }, [router]);
  const auth = useMemo(() => (token ? { token } : null), [token]);
  const { pub, team, role, connected, kicked, offset, emit } = useMarket(auth);
  const seconds = useCountdown(pub, offset);
  const [selected, setSelected] = useState("NVTX");
  const [picked, setPicked] = useState<{ price: number; n: number } | null>(null);

  useEffect(() => {
    // Server didn't recognise the stored token (e.g. organiser reset access or new competition).
    if (connected && role === "guest" && token) {
      safeSet(TOKEN_KEY, null);
      router.replace("/");
    }
  }, [connected, role, token, router]);

  if (kicked) {
    return (
      <main className="flex min-h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg">{kicked}</p>
          <button
            className="btn mt-4 bg-accent text-black"
            onClick={() => {
              safeSet(TOKEN_KEY, null);
              router.replace("/");
            }}
          >
            Back to sign-in
          </button>
        </div>
      </main>
    );
  }
  if (!pub || !team) return <main className="flex min-h-full items-center justify-center text-muted">Connecting to the trading floor…</main>;

  const stock = pub.stocks.find((s) => s.ticker === selected) ?? pub.stocks[0];
  const holdings = Object.fromEntries(team.positions.map((p) => [p.ticker, p.shares]));

  return (
    <div className="flex h-screen min-h-[640px] flex-col">
      <TopBar pub={pub} team={team} seconds={seconds} connected={connected} />
      <div className={`px-4 py-1 text-center text-xs font-semibold ${pub.phase === "TRADING" && !pub.paused ? "bg-up/10 text-up" : "bg-panel-2 text-muted"}`}>
        {pub.paused ? "Market paused by the organiser. The clock is stopped; no orders can be placed." : PHASE_LABEL[pub.phase]}
      </div>
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-y-auto p-2 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-[3]">
            <Watchlist stocks={pub.stocks} selected={stock.ticker} onSelect={setSelected} holdings={holdings} />
          </div>
          <div className="min-h-0 flex-[2]">
            <NewsFeed pub={pub} />
          </div>
        </div>
        <div className="scroll-thin flex min-h-0 flex-col gap-2 lg:overflow-y-auto">
          <StockDetail stock={stock} />
          <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-2">
            <OrderBookPanel stock={stock} onPick={(price) => setPicked({ price, n: Date.now() })} />
            <OrderTicket stock={stock} team={team} pub={pub} emit={emit} pickedPrice={picked} />
          </div>
          <div className="min-h-48 flex-1">
            <Portfolio team={team} pub={pub} emit={emit} onSelect={setSelected} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="min-h-0 flex-[3]">
            <IntelPanel pub={pub} team={team} emit={emit} />
          </div>
          <div className="min-h-0 flex-[2]">
            <TradeTape pub={pub} />
          </div>
        </div>
      </main>
      <PhaseOverlay pub={pub} team={team} />
    </div>
  );
}
