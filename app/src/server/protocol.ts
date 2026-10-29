import { z } from "zod";

// Messages a participant terminal may send. Team identity is never taken from
// the payload: the server attaches it from the authenticated session.
const price = z.number().positive().max(100000);
const qty = z.number().int().positive().max(100000);
const ticker = z.string().min(2).max(6);

export const TeamCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PLACE_ORDER"), clientOrderId: z.string().min(8).max(64), ticker, side: z.enum(["BUY", "SELL"]), orderType: z.enum(["LIMIT", "MARKET"]), price: price.optional(), qty }),
  z.object({ type: z.literal("CANCEL_ORDER"), orderId: z.string().uuid() }),
  z.object({ type: z.literal("MODIFY_ORDER"), orderId: z.string().uuid(), price: price.optional(), qty: qty.optional() }),
  z.object({ type: z.literal("BUY_RESEARCH"), researchId: z.string().max(16) }),
  z.object({ type: z.literal("SUBMIT_FORECAST"), round: z.number().int().min(1).max(50), direction: z.enum(["UP", "DOWN"]) }),
]);
export type TeamCommand = z.infer<typeof TeamCommand>;

export const AdminCommand = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SETUP_TEAMS"), count: z.number().int().min(1).max(60), names: z.array(z.string().max(40)).optional() }),
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("ADVANCE") }),
  z.object({ type: z.literal("PAUSE") }),
  z.object({ type: z.literal("RESUME") }),
  z.object({ type: z.literal("RESTART_ROUND"), reason: z.string().min(3).max(200) }),
  z.object({ type: z.literal("TERMINATE"), reason: z.string().min(3).max(200) }),
  z.object({ type: z.literal("REVEAL_DEBRIEF") }),
  z.object({ type: z.literal("NOTE"), text: z.string().min(1).max(500) }),
  z.object({ type: z.literal("RESET_SESSION"), teamId: z.string() }),
  z.object({ type: z.literal("NEW_COMPETITION") }),
]);
export type AdminCommand = z.infer<typeof AdminCommand>;

/** Convert a credits price from the client to integer cents, rejecting more than 2 decimals. */
export function toCents(p: number): number | null {
  const c = Math.round(p * 100);
  return Math.abs(c - p * 100) < 1e-6 ? c : null;
}
