"use client";
import { useEffect, useState } from "react";
import type { PublicView, TeamView } from "@/engine/views";
import { change, clock, money, pct, signedMoney, tone } from "@/lib/format";
import { CompanyBriefing } from "./Companies";

type Debrief = { rounds: { round: number; title: string; hiddenState: string; fundamentals: Record<string, number>; signals: { ticker: string; text: string; reliability: string; truth: string; source: string }[] }[] };

export function TopBar({ pub, team, seconds, connected }: { pub: PublicView; team: TeamView; seconds: number | null; connected: boolean }) {
  const phaseTone = pub.phase === "TRADING" ? "bg-up text-black" : pub.phase === "NEWS" ? "bg-accent text-black" : pub.phase === "BRIEFING" ? "bg-info text-black" : "bg-panel-2 text-muted";
  const ret = team.returnPct;
  const [companies, setCompanies] = useState(false);
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line bg-panel px-4 py-2">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.25em] text-accent uppercase">The Information War</p>
        <p className="font-semibold">{team.team.name}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded px-2 py-1 text-xs font-bold uppercase ${phaseTone}`}>{pub.paused ? "Paused" : pub.phase === "LOBBY" ? "Lobby" : pub.phase}</span>
        <div>
          <p className="text-[10px] text-muted uppercase">{pub.round ? `Round ${pub.round} / ${pub.totalRounds}` : pub.phase === "BRIEFING" ? "Before Round 1" : "Not started"}</p>
          <p className="text-sm font-semibold">{pub.roundTitle ?? (pub.phase === "BRIEFING" ? "Company briefing" : "—")}</p>
        </div>
        <p className={`num text-3xl font-bold ${seconds !== null && seconds <= 20 && pub.phase === "TRADING" ? "text-down" : ""}`}>{clock(seconds)}</p>
        <button className="btn-ghost text-xs" onClick={() => setCompanies(true)}>
          Company profiles
        </button>
      </div>
      {companies && (
        <Modal wide onClose={() => setCompanies(false)}>
          <h2 className="mb-3 text-xl font-bold">Company profiles</h2>
          <CompanyBriefing stocks={pub.stocks} />
        </Modal>
      )}
      <div className="ml-auto flex gap-6 text-right">
        <Stat label="Equity" value={money(team.equity)} />
        <Stat label="Return" value={pct(ret)} className={tone(ret)} />
        <Stat label="Cash" value={money(team.availableCash)} sub={team.reservedCash ? `${money(team.reservedCash)} in orders` : undefined} />
        <Stat label="Rank" value={team.rank ? `${team.rank} / ${team.teamsTotal}` : "—"} sub="as of last round" />
        <span className={`self-center text-xs ${connected ? "text-up" : "text-down"}`}>● {connected ? "live" : "reconnecting"}</span>
      </div>
    </header>
  );
}

function Stat({ label, value, sub, className = "" }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted uppercase">{label}</p>
      <p className={`num text-lg font-semibold ${className}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted">{sub}</p>}
    </div>
  );
}

function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={`panel scroll-thin relative max-h-[90vh] w-full overflow-y-auto p-5 ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
        {onClose && (
          <button onClick={onClose} className="absolute top-3 right-3 text-muted hover:text-text" aria-label="Close">
            ✕
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

export function PhaseOverlay({ pub, team }: { pub: PublicView; team: TeamView }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const key = `${pub.phase}-${pub.round}`;
  useEffect(() => setDismissed(null), [key]);
  if (dismissed === key) return null;
  const close = () => setDismissed(key);

  const r = pub.rules as { startingCapital: number; maxBuyOrderNotional: number; tradingSeconds: number; briefingSeconds: number; startWithHoldings: boolean };
  if (pub.phase === "LOBBY") {
    return (
      <Modal onClose={close}>
        <h2 className="text-xl font-bold">Welcome, {team.team.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Waiting for the organiser to start. {r.briefingSeconds ? `The event opens with a ${Math.round((r.briefingSeconds / 60) * 10) / 10}-minute company briefing before Round 1.` : ""} You can explore the terminal; trading is disabled.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
          <li>{r.startWithHoldings ? `You start with ${r.startingCapital.toLocaleString()} credits: cash plus a holding in every stock.` : `You start with ${r.startingCapital.toLocaleString()} credits, all in cash. You hold no shares until you buy them.`}</li>
          <li>10 rounds: 20 s of news, {Math.round(r.tradingSeconds / 60 * 10) / 10} min of trading, 20 s of settlement.</li>
          <li>Your score is <b>equity = cash + shares × reference value</b>. The last traded price does not set your score.</li>
          <li>No short selling, no borrowing. Max {r.maxBuyOrderNotional.toLocaleString()} credits per buy order; sell orders have no value limit, and there is no limit on how much you trade in a round. Open orders are cancelled at each round end.</li>
          <li>Private intelligence may be accurate, incomplete, outdated or misleading.</li>
        </ul>
      </Modal>
    );
  }

  if (pub.phase === "BRIEFING") {
    return (
      <Modal wide onClose={close}>
        <p className="text-xs font-semibold tracking-widest text-info uppercase">Company briefing · before Round 1</p>
        <h2 className="text-xl font-bold">Study the ten companies</h2>
        <p className="mt-1 mb-3 text-sm text-muted">
          Trading is closed. Round 1 news is released when the clock ends. Profiles describe each business as it stands today; they do not predict what happens next. Reopen this any time from <b>Company profiles</b> in the top bar.
        </p>
        <CompanyBriefing stocks={pub.stocks} />
      </Modal>
    );
  }

  if (pub.phase === "SETTLING") {
    const res = pub.roundResults.find((r) => r.round === pub.round);
    if (!res) return null;
    const mine = team.history.find((h) => h.round === pub.round);
    const prev = team.history.find((h) => h.round === pub.round - 1)?.equity ?? team.startingCapital;
    return (
      <Modal onClose={close}>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Round {pub.round} summary</p>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted">Your equity</p>
            <p className="num text-3xl font-bold">{money(mine?.equity)}</p>
            {mine && <p className={`num ${tone(mine.equity - prev)}`}>{signedMoney(mine.equity - prev)} this round</p>}
            <p className="mt-2 text-sm">
              Rank <b>{team.rank}</b> of {team.teamsTotal}
            </p>
            <p className="mt-3 text-xs font-semibold text-muted uppercase">Top 5</p>
            <ol className="text-sm">
              {res.top.map((t) => (
                <li key={t.rank} className="flex justify-between border-b border-line/50 py-0.5">
                  <span>
                    {t.rank}. {t.teamName}
                  </span>
                  <span className={`num ${tone(t.returnPct)}`}>{pct(t.returnPct)}</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Reference values</p>
            <table className="w-full text-sm">
              <tbody>
                {Object.keys(res.rvEnd).map((t) => {
                  const d = change(res.rvEnd[t], res.rvStart[t]);
                  return (
                    <tr key={t} className="border-b border-line/50">
                      <td className="py-0.5 font-semibold">{t}</td>
                      <td className="num text-right text-muted">{money(res.rvStart[t])}</td>
                      <td className="num text-right">{money(res.rvEnd[t])}</td>
                      <td className={`num text-right ${tone(d)}`}>{pct(d, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{pub.round < pub.totalRounds ? "Next round's news is released when this countdown ends." : "Final results are being locked."}</p>
      </Modal>
    );
  }

  if (pub.phase === "FINISHED" && pub.finalLeaderboard) {
    const debrief = pub.debrief as Debrief | null;
    return (
      <Modal>
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">Final results</p>
        <h2 className="text-2xl font-bold">
          {team.team.name}: rank {team.rank} of {team.teamsTotal}, {pct(team.returnPct)}
        </h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-[10px] text-muted uppercase">
            <tr>
              <th className="text-left">#</th>
              <th className="text-left">Team</th>
              <th className="text-right">Equity</th>
              <th className="text-right">Return</th>
              <th className="text-right">Forecast pts</th>
            </tr>
          </thead>
          <tbody>
            {pub.finalLeaderboard.map((r) => (
              <tr key={r.rank} className={`border-b border-line/50 ${r.teamName === team.team.name ? "bg-accent/10" : ""}`}>
                <td className="py-0.5">{r.rank}</td>
                <td>{r.teamName}</td>
                <td className="num text-right">{money(r.equity)}</td>
                <td className={`num text-right ${tone(r.returnPct)}`}>{pct(r.returnPct)}</td>
                <td className="num text-right">{r.forecastScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {debrief ? (
          <div className="mt-5">
            <h3 className="text-lg font-bold">Debrief: what was really happening</h3>
            {debrief.rounds.map((r) => (
              <div key={r.round} className="mt-3 border-t border-line pt-2">
                <p className="font-semibold">
                  Round {r.round}: {r.title}
                </p>
                <p className="text-xs text-muted">{r.hiddenState}</p>
                <ul className="mt-1 space-y-1 text-xs">
                  {r.signals.map((s, i) => (
                    <li key={i}>
                      <span className={s.reliability === "ACCURATE" ? "text-up" : s.reliability === "MISLEADING" ? "text-down" : "text-accent"}>[{s.reliability}]</span> {s.ticker}: “{s.text}” → {s.truth}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted">The organiser will reveal the hidden scenario and signal reliability during the debrief.</p>
        )}
      </Modal>
    );
  }
  return null;
}
