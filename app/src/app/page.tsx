"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { safeGet, safeSet, TOKEN_KEY, useMarket } from "@/lib/useMarket";

const GUEST = {};

export default function Login() {
  const router = useRouter();
  const { emit, connected, pub } = useMarket(GUEST);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (safeGet(TOKEN_KEY)) router.replace("/terminal");
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = (await emit("login", { code })) as { ok: boolean; error?: string; token?: string };
    setBusy(false);
    if (!res.ok || !res.token) return setError(res.error ?? "Sign-in failed");
    safeSet(TOKEN_KEY, res.token);
    router.replace("/terminal");
  }

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold tracking-[0.3em] text-accent uppercase">Trading floor simulation</p>
        <h1 className="mt-1 text-3xl font-bold">The Information War</h1>
        <p className="mt-2 text-sm text-muted">Ten fictional stocks. Ten rounds. Incomplete, uneven and sometimes misleading information.</p>
        <form onSubmit={submit} className="panel mt-6 space-y-3 p-4">
          <label className="block text-xs font-semibold tracking-wider text-muted uppercase" htmlFor="code">
            Team code
          </label>
          <input id="code" className="input text-lg tracking-[0.3em] uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" autoComplete="off" autoFocus />
          {error && <p className="text-sm text-down">{error}</p>}
          <button className="btn w-full bg-accent text-black" disabled={busy || !connected || code.trim().length < 4}>
            {connected ? (busy ? "Signing in…" : "Enter the trading floor") : "Connecting…"}
          </button>
          <p className="text-xs text-muted">One device per team. If you are locked out, ask technical support to reset your access.</p>
        </form>
        {pub && <p className="mt-3 text-center text-xs text-muted">Market status: {pub.phase === "LOBBY" ? "lobby open, trading has not started" : `round ${pub.round} of ${pub.totalRounds}`}</p>}
      </div>
    </main>
  );
}
