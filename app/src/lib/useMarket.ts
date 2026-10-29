"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { adminView, PublicView, TeamView } from "@/engine/views";

export type AdminState = ReturnType<typeof adminView> & { health: Record<string, unknown> & { connections: Record<string, number>; signedIn: Record<string, boolean> } };
export interface Ack {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  data?: unknown;
}

export const TOKEN_KEY = "iw.teamToken";

function safeGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode); session lasts until reload
  }
}

/**
 * One socket per page. Reconnects automatically; on every (re)connect the
 * server pushes the full current state, so a dropped connection self-heals.
 */
export function useMarket(auth: { token?: string | null; adminKey?: string | null } | null) {
  const [pub, setPub] = useState<PublicView | null>(null);
  const [team, setTeam] = useState<TeamView | null>(null);
  const [admin, setAdmin] = useState<AdminState | null>(null);
  const [role, setRole] = useState<string>("unknown");
  const [connected, setConnected] = useState(false);
  const [kicked, setKicked] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const sock = useRef<Socket | null>(null);

  useEffect(() => {
    if (!auth) return;
    const s = io({ auth: { token: auth.token ?? undefined, adminKey: auth.adminKey ?? undefined }, transports: ["websocket", "polling"] });
    sock.current = s;
    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("hello", (h: { role: string }) => setRole(h.role));
    s.on("public", (p: PublicView) => {
      setPub(p);
      setOffset(p.serverTime - Date.now());
    });
    s.on("team", setTeam);
    s.on("adminState", setAdmin);
    s.on("kicked", (msg: string) => setKicked(msg));
    return () => {
      s.disconnect();
      sock.current = null;
    };
  }, [auth?.token, auth?.adminKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback(
    (event: string, payload: unknown) =>
      new Promise<Ack>((resolve) => {
        const s = sock.current;
        if (!s?.connected) return resolve({ ok: false, error: "Not connected — reconnecting…" });
        s.timeout(8000).emit(event, payload, (err: unknown, res: Ack) => resolve(err ? { ok: false, error: "No response from server (your order may still have been received — check Open orders)" } : res));
      }),
    [],
  );

  return { pub, team, admin, role, connected, kicked, offset, emit };
}

/** Seconds left in the current phase, from the server clock. */
export function useCountdown(pub: PublicView | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  if (!pub) return null;
  if (pub.paused) return Math.ceil(pub.pausedRemainingMs / 1000);
  if (!pub.phaseEndsAt) return null;
  return Math.max(0, Math.ceil((pub.phaseEndsAt - (now + offset)) / 1000));
}

export { safeGet };
