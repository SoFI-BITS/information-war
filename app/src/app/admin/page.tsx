"use client";
import { useEffect, useMemo, useState } from "react";
import { AdminConsole } from "@/components/admin/AdminConsole";
import { safeGet, safeSet, useMarket } from "@/lib/useMarket";

const KEY = "iw.adminKey";

export default function AdminPage() {
  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  useEffect(() => setKey(safeGet(KEY)), []);
  const auth = useMemo(() => (key ? { adminKey: key } : null), [key]);
  const market = useMarket(auth);

  useEffect(() => {
    if (market.role === "guest" && key) {
      safeSet(KEY, null);
      setKey(null);
    }
  }, [market.role, key]);

  if (!key) {
    return (
      <main className="flex min-h-full items-center justify-center p-4">
        <form
          className="panel w-full max-w-sm space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            safeSet(KEY, draft);
            setKey(draft);
          }}
        >
          <h1 className="text-lg font-bold">Organiser console</h1>
          <input className="input" type="password" placeholder="Admin key" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button className="btn w-full bg-accent text-black">Open console</button>
        </form>
      </main>
    );
  }
  if (!market.admin || !market.pub) return <main className="flex min-h-full items-center justify-center text-muted">Connecting…</main>;
  return <AdminConsole {...market} admin={market.admin} pub={market.pub} adminKey={key} onLogout={() => (safeSet(KEY, null), setKey(null))} />;
}
