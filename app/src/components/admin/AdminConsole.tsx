"use client";
import { useState } from "react";
import type { PublicView } from "@/engine/views";
import { change, clock, money, pct, time, tone } from "@/lib/format";
import { type Ack, type AdminState, useCountdown } from "@/lib/useMarket";

interface Props {
  admin: AdminState;
  pub: PublicView;
  offset: number;
  connected: boolean;
  adminKey: string;
  emit: (e: string, p: unknown) => Promise<Ack>;
  onLogout: () => void;
}

const EXPORTS = ["results", "rounds", "reference-values", "trades", "orders", "teams", "audit", "commands"];

export function AdminConsole({ admin, pub, offset, connected, adminKey, emit, onLogout }: Props) {
  const seconds = useCountdown(pub, offset);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [teamCount, setTeamCount] = useState("24");
  const [names, setNames] = useState("");
  const [note, setNote] = useState("");
  const h = admin.health as AdminState["health"] & { competitionId: string; store: string; scenarioHash: string; scenarioLocked: string | null; uptimeSec: number; memoryMb: number; commands: number; persistencePending: number; persistenceError: string | null; lastSeen: Record<string, number> };

  async function send(payload: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    const res = await emit("admin", payload);
    setMsg({ ok: res.ok, text: res.ok ? `${payload.type} done` : res.error ?? "Failed" });
  }
  function withReason(type: string, question: string) {
    const reason = window.prompt(question);
    if (reason && reason.trim().length >= 3) send({ type, reason: reason.trim() });
  }
  async function download(kind: string) {
    const res = await fetch(`/api/export/${kind}`, { headers: { "x-admin-key": adminKey } });
    if (!res.ok) return setMsg({ ok: false, text: `Export failed (${res.status})` });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ?? `${kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const inRound = ["NEWS", "TRADING", "SETTLING"].includes(admin.phase);
  const connectedTeams = Object.values(h.connections).filter((n) => n > 0).length;

  return (
    <div className="min-h-full space-y-3 p-3">
      <header className="panel flex flex-wrap items-center gap-6 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.25em] text-accent uppercase">Organiser console</p>
          <p className="font-semibold">{h.competitionId}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted uppercase">Status</p>
          <p className="font-semibold">
            {admin.paused ? "PAUSED · " : ""}
            {admin.phase} {admin.round ? `· Round ${admin.round}/${pub.totalRounds}` : ""}
          </p>
        </div>
        <p className="num text-4xl font-bold">{clock(seconds)}</p>
        <div className="text-xs text-muted">
          <p>
            Teams online <b className="text-text">{connectedTeams}</b> / {admin.teams.length} · trades {admin.tradeCount}
          </p>
          <p>
            Store {h.store} · pending writes {h.persistencePending} · commands {h.commands} · {h.memoryMb} MB · up {Math.round(h.uptimeSec / 60)} min
          </p>
          <p>
            Scenario {h.scenarioHash} {h.scenarioLocked ? `locked ${h.scenarioLocked}` : <span className="text-accent">(not marked locked)</span>}
          </p>
          {h.persistenceError && <p className="text-down">Persistence error: {h.persistenceError}</p>}
        </div>
        <span className={`ml-auto text-xs ${connected ? "text-up" : "text-down"}`}>● {connected ? "live" : "reconnecting"}</span>
        <button className="btn-ghost text-xs" onClick={onLogout}>
          Sign out
        </button>
      </header>

      <section className="panel flex flex-wrap items-center gap-2 p-3">
        <button className="btn bg-up text-black" disabled={admin.phase !== "LOBBY" || !admin.teams.length} onClick={() => send({ type: "START" }, "Start Round 1 now? The scenario is locked from this point.")}>
          Start event
        </button>
        {admin.paused ? (
          <button className="btn bg-accent text-black" onClick={() => send({ type: "RESUME" })}>
            Resume
          </button>
        ) : (
          <button className="btn bg-accent text-black" disabled={!inRound} onClick={() => send({ type: "PAUSE" })}>
            Pause
          </button>
        )}
        <button className="btn-ghost" disabled={!inRound || admin.paused} onClick={() => send({ type: "ADVANCE" }, `End the current ${admin.phase} phase now?`)}>
          Skip to next phase
        </button>
        <button className="btn-ghost text-accent" disabled={!inRound} onClick={() => withReason("RESTART_ROUND", "Void and restart this round? All its trades are reversed. Reason (logged):")}>
          Void &amp; restart round
        </button>
        <button className="btn-ghost text-down" disabled={admin.phase === "FINISHED" || admin.phase === "LOBBY"} onClick={() => withReason("TERMINATE", "Terminate the event? An in-progress round is voided; results stand at the last settled round. Reason (logged):")}>
          Terminate
        </button>
        <button className="btn-ghost" disabled={admin.phase !== "FINISHED"} onClick={() => send({ type: "REVEAL_DEBRIEF" }, "Reveal the hidden scenario and signal reliability to all teams?")}>
          Reveal debrief
        </button>
        <button className="btn-ghost" disabled={admin.phase !== "FINISHED" && admin.phase !== "LOBBY"} onClick={() => send({ type: "NEW_COMPETITION" }, "Archive this competition and create a fresh one? Teams will need new codes.")}>
          New competition
        </button>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) send({ type: "NOTE", text: note.trim() }).then(() => setNote(""));
          }}
        >
          <input className="input w-64" placeholder="Audit note (e.g. Team 7 laptop swapped)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-ghost">Log</button>
        </form>
        {msg && <p className={`w-full text-xs ${msg.ok ? "text-up" : "text-down"}`}>{msg.text}</p>}
      </section>

      {admin.phase === "LOBBY" && (
        <section className="panel space-y-2 p-3">
          <h2 className="text-sm font-semibold">Register teams</h2>
          <p className="text-xs text-muted">Creates the team list and login codes (replaces any existing list and signs everyone out). Teams are assigned to intel groups A–F by number.</p>
          <div className="flex flex-wrap gap-2">
            <input className="input w-24" value={teamCount} onChange={(e) => setTeamCount(e.target.value.replace(/\D/g, ""))} />
            <textarea className="input h-20 flex-1 font-sans" placeholder="Optional team names, one per line (in team-number order)" value={names} onChange={(e) => setNames(e.target.value)} />
            <button
              className="btn bg-info text-black"
              onClick={() => send({ type: "SETUP_TEAMS", count: Number(teamCount), names: names.split("\n").map((s) => s.trim()).filter(Boolean) }, `Register ${teamCount} teams? Existing codes will stop working.`)}
            >
              Register teams
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="panel">
          <div className="panel-title">
            <span>Teams &amp; live leaderboard (indicative, at current RV)</span>
            <span className="normal-case tracking-normal">{admin.teams.length} teams</span>
          </div>
          <div className="scroll-thin max-h-[480px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-panel text-[10px] text-muted uppercase">
                <tr>
                  {["Rank", "#", "Team", "Code", "Grp", "Online", "Equity", "Return", "Cash", "Orders", "Research", "Fcst", ""].map((x, i) => (
                    <th key={i} className="px-2 py-1 text-left">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...admin.teams]
                  .sort((a, b) => a.rank - b.rank)
                  .map((t) => {
                    const online = (h.connections[t.id] ?? 0) > 0;
                    const signed = !!h.signedIn[t.id];
                    return (
                      <tr key={t.id} className="border-t border-line/50">
                        <td className="px-2 py-1 font-semibold">{t.rank}</td>
                        <td className="px-2">{t.number}</td>
                        <td className="px-2">{t.name}</td>
                        <td className="num px-2 tracking-widest">{t.code}</td>
                        <td className="px-2 text-muted">{t.group}</td>
                        <td className={`px-2 ${online ? "text-up" : signed ? "text-down" : "text-muted"}`}>{online ? "● online" : signed ? "● disconnected" : "not signed in"}</td>
                        <td className="num px-2">{money(t.equity)}</td>
                        <td className={`num px-2 ${tone(t.returnPct)}`}>{pct(t.returnPct)}</td>
                        <td className="num px-2">{money(t.cash, 0)}</td>
                        <td className="num px-2">{t.openOrders}</td>
                        <td className="num px-2">{t.researchCredits}</td>
                        <td className="num px-2">{t.forecastScore}</td>
                        <td className="px-2">
                          {signed && (
                            <button className="text-accent hover:underline" onClick={() => send({ type: "RESET_SESSION", teamId: t.id }, `Reset ${t.name}'s session? Their device is signed out and they can sign in again with the code.`)}>
                              Reset access
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            <span>Market monitor</span>
            <span className="normal-case tracking-normal text-accent">F = hidden fundamental (organiser only)</span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-[10px] text-muted uppercase">
              <tr>
                {["Stock", "RV open", "RV", "F", "Scripted Δ", "Last", "MM mid", "Net MM flow"].map((x, i) => (
                  <th key={x} className={`px-2 py-1 ${i ? "text-right" : "text-left"}`}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admin.stocks.map((s) => (
                <tr key={s.ticker} className="border-t border-line/50">
                  <td className="px-2 py-1 font-semibold">{s.ticker}</td>
                  <td className="num px-2 text-right">{money(s.rvStart)}</td>
                  <td className="num px-2 text-right">{money(s.rv)}</td>
                  <td className="num px-2 text-right text-accent">{money(s.fundamental)}</td>
                  <td className={`num px-2 text-right ${tone(s.roundMove ?? 0)}`}>{s.roundMove === null ? "—" : `${s.roundMove > 0 ? "+" : ""}${s.roundMove}%`}</td>
                  <td className="num px-2 text-right">{money(s.lastPrice)}</td>
                  <td className={`num px-2 text-right ${tone(change(s.mmMid, s.rvStart))}`}>{money(s.mmMid)}</td>
                  <td className={`num px-2 text-right ${tone(s.mmNet)}`}>{money(s.mmNet, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {admin.round_ && (
            <div className="border-t border-line p-3 text-xs">
              <p className="font-semibold">
                Round {admin.round}: {admin.round_.title} <span className="font-normal text-muted">— {admin.round_.purpose}</span>
              </p>
              <p className="mt-1 text-muted">Hidden state: {admin.round_.hiddenState}</p>
              <ul className="mt-1 space-y-0.5">
                {admin.round_.signals.map((s) => (
                  <li key={s.id}>
                    <span className="text-info">{s.groups.join("+")}</span> {s.ticker} <span className={s.reliability === "ACCURATE" ? "text-up" : s.reliability === "MISLEADING" ? "text-down" : "text-accent"}>[{s.reliability}]</span> {s.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <section className="panel">
          <div className="panel-title">Recent executions (with counterparties)</div>
          <div className="scroll-thin max-h-72 overflow-auto">
            <table className="w-full text-xs">
              <tbody>
                {admin.recentTrades.map((t) => (
                  <tr key={t.id} className={`border-t border-line/40 ${t.voided ? "line-through opacity-40" : ""}`}>
                    <td className="num px-2 py-0.5 text-muted">{time(t.ts)}</td>
                    <td className="px-2 font-semibold">{t.ticker}</td>
                    <td className="num px-2 text-right">{money(t.price)}</td>
                    <td className="num px-2 text-right">{t.qty}</td>
                    <td className="px-2 text-up">{t.buyer}</td>
                    <td className="px-2 text-down">{t.seller}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">Audit log (append-only)</div>
          <div className="scroll-thin max-h-72 overflow-auto text-xs">
            {admin.audit.map((a) => (
              <p key={a.seq} className="border-t border-line/40 px-2 py-0.5">
                <span className="num text-muted">{time(a.ts)}</span> <span className="text-info">{a.actor}</span> <b>{a.action}</b> {a.detail}
              </p>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">Exports (results verifier)</div>
          <div className="flex flex-wrap gap-2 p-3">
            {EXPORTS.map((k) => (
              <button key={k} className="btn-ghost text-xs" onClick={() => download(k)}>
                {k}
              </button>
            ))}
          </div>
          <p className="px-3 pb-3 text-xs text-muted">“commands” is the full replayable event log; keep it with the results. “teams” includes login codes and intel groups — print it for the registration desk.</p>
        </section>
      </div>
    </div>
  );
}
