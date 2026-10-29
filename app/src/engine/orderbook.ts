import type { Order, Side } from "./types";

export interface Fill {
  resting: Order;
  qty: number;
  /** Execution price = the resting order's price (standard CLOB convention). */
  price: number;
}

export interface Level {
  price: number;
  qty: number;
  orders: number;
}

/**
 * Central limit order book for one stock with strict price-time priority.
 *
 * Bids are kept best-first (highest price, then lowest seq); asks best-first
 * (lowest price, then lowest seq). Books are small (tens of orders), so sorted
 * arrays with binary insertion are simpler and faster than a tree.
 */
export class OrderBook {
  readonly bids: Order[] = [];
  readonly asks: Order[] = [];

  constructor(readonly ticker: string) {}

  private sideArr(side: Side) {
    return side === "BUY" ? this.bids : this.asks;
  }

  /** True when `a` has priority over `b` on the given side. */
  private static before(side: Side, a: Order, b: Order) {
    if (a.price !== b.price) return side === "BUY" ? a.price > b.price : a.price < b.price;
    return a.seq < b.seq;
  }

  add(order: Order) {
    const arr = this.sideArr(order.side);
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (OrderBook.before(order.side, arr[mid], order)) lo = mid + 1;
      else hi = mid;
    }
    arr.splice(lo, 0, order);
  }

  remove(orderId: string): Order | undefined {
    for (const arr of [this.bids, this.asks]) {
      const i = arr.findIndex((o) => o.id === orderId);
      if (i >= 0) return arr.splice(i, 1)[0];
    }
    return undefined;
  }

  best(side: Side): Order | undefined {
    return this.sideArr(side)[0];
  }

  /**
   * Match an incoming order against the opposite side.
   *
   * `limit` is the worst acceptable price (limit price, or market-order collar).
   * `onSelfTrade` is called when the best opposite order belongs to the same
   * owner; it must remove that order (self-trade prevention: cancel resting).
   * Fills are applied to resting orders here; the caller settles cash/shares.
   */
  match(incoming: Order, limit: number, onSelfTrade: (resting: Order) => void): Fill[] {
    const opp = incoming.side === "BUY" ? this.asks : this.bids;
    const crosses = (p: number) => (incoming.side === "BUY" ? p <= limit : p >= limit);
    const fills: Fill[] = [];
    while (incoming.remaining > 0 && opp.length > 0 && crosses(opp[0].price)) {
      const resting = opp[0];
      if (resting.teamId === incoming.teamId) {
        opp.shift();
        onSelfTrade(resting);
        continue;
      }
      const qty = Math.min(incoming.remaining, resting.remaining);
      resting.remaining -= qty;
      resting.filled += qty;
      incoming.remaining -= qty;
      incoming.filled += qty;
      fills.push({ resting, qty, price: resting.price });
      if (resting.remaining === 0) {
        resting.status = "FILLED";
        opp.shift();
      } else {
        resting.status = "PARTIAL";
      }
    }
    return fills;
  }

  /** Aggregated, anonymous depth: price, total quantity, number of orders. */
  levels(side: Side, depth: number): Level[] {
    const out: Level[] = [];
    for (const o of this.sideArr(side)) {
      const last = out[out.length - 1];
      if (last && last.price === o.price) {
        last.qty += o.remaining;
        last.orders += 1;
      } else {
        if (out.length === depth) break;
        out.push({ price: o.price, qty: o.remaining, orders: 1 });
      }
    }
    return out;
  }

  all(): Order[] {
    return [...this.bids, ...this.asks];
  }

  clear(): Order[] {
    const removed = this.all();
    this.bids.length = 0;
    this.asks.length = 0;
    return removed;
  }
}
