export const money = (cents: number | null | undefined, digits = 2) =>
  cents === null || cents === undefined ? "—" : (cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const signedMoney = (cents: number) => `${cents >= 0 ? "+" : "−"}${money(Math.abs(cents))}`;

export const pct = (x: number, digits = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(digits)}%`;

export const change = (now: number, before: number) => (before ? ((now - before) / before) * 100 : 0);

export const clock = (sec: number | null) => (sec === null ? "--:--" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

export const time = (ts: number) => new Date(ts).toLocaleTimeString("en-GB", { hour12: false });

export const tone = (x: number) => (x > 0 ? "text-up" : x < 0 ? "text-down" : "text-muted");

export const PHASE_LABEL: Record<string, string> = {
  LOBBY: "Waiting to start",
  NEWS: "News — read the briefing",
  TRADING: "Trading open",
  SETTLING: "Round closed — settling",
  FINISHED: "Event finished",
};
