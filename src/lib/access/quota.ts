/**
 * Server-side quota counting.
 *
 * The free allowance has to be enforced here, not in the browser: a number in
 * `localStorage` is a suggestion, and the whole business model rests on this
 * one count being true. Two independent counters per identity:
 *
 *   - `licence` — every carousel, whoever's key wrote it. This is what the
 *     Maker licence lifts.
 *   - `hosted`  — only the ones that ran on our embedded key, i.e. the ones we
 *     actually pay for. Licence holders have a monthly allowance here; BYOK
 *     users never touch it.
 *
 * Windows are rolling, not calendar: "2 a week" means two in any trailing
 * seven days. Calendar weeks hand everyone a fresh pair at midnight Sunday and
 * invite the "wait for the reset" dance; a rolling window is fairer and much
 * harder to game.
 *
 * The store is pluggable and the default is in-memory, which is correct for a
 * single instance (the deploy pins one replica — see `railway.toml`). Swap in
 * a durable one with `setQuotaStore` when there are several; the interface is
 * deliberately tiny so that's a few lines.
 */

import type { QuotaPeriod } from "../plan";

export type Meter = "licence" | "hosted";

const MINUTE = 60_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** Milliseconds in a plan's quota period. `lifetime` looks all the way back. */
export function windowMs(period: QuotaPeriod): number {
  switch (period) {
    case "day":
      return DAY;
    case "week":
      return WEEK;
    case "month":
      return MONTH;
    case "lifetime":
      return Number.POSITIVE_INFINITY;
  }
}

/** When the oldest hit in the window falls out, in seconds — "try again in…". */
export function secondsUntilFree(hits: number[], period: QuotaPeriod, now: number): number | undefined {
  const span = windowMs(period);
  if (!Number.isFinite(span) || hits.length === 0) return undefined;
  const oldest = Math.min(...hits);
  return Math.max(1, Math.ceil((oldest + span - now) / 1000));
}

export interface QuotaStore {
  /** Timestamps of this identity's hits on a meter, newest last. */
  hits(identity: string, meter: Meter, since: number): number[];
  /** Record one hit. */
  record(identity: string, meter: Meter, at: number): void;
  /** Undo the most recent hit — used when the work never actually ran. */
  rollback(identity: string, meter: Meter): void;
}

/** In-memory store. Prunes lazily so memory stays bounded. */
export class MemoryQuotaStore implements QuotaStore {
  private data = new Map<string, number[]>();
  /** Anything older than this can never matter to a rolling window. */
  private retention = MONTH + DAY;

  private key(identity: string, meter: Meter) {
    return `${meter}:${identity}`;
  }

  hits(identity: string, meter: Meter, since: number): number[] {
    const arr = this.data.get(this.key(identity, meter)) ?? [];
    return since > 0 ? arr.filter((t) => t > since) : [...arr];
  }

  record(identity: string, meter: Meter, at: number): void {
    const k = this.key(identity, meter);
    const arr = (this.data.get(k) ?? []).filter((t) => at - t < this.retention);
    arr.push(at);
    this.data.set(k, arr);
    if (this.data.size > 20_000) this.prune(at);
  }

  rollback(identity: string, meter: Meter): void {
    const arr = this.data.get(this.key(identity, meter));
    if (arr?.length) arr.pop();
  }

  private prune(now: number) {
    for (const [k, v] of this.data) {
      const kept = v.filter((t) => now - t < this.retention);
      if (kept.length) this.data.set(k, kept);
      else this.data.delete(k);
    }
  }
}

let store: QuotaStore = new MemoryQuotaStore();

export function setQuotaStore(s: QuotaStore): void {
  store = s;
}

/** Reset to a fresh in-memory store. Test helper. */
export function resetQuota(): void {
  store = new MemoryQuotaStore();
}

export function getQuotaStore(): QuotaStore {
  return store;
}

/** How many hits an identity has on a meter within a plan's period. */
export function usedInPeriod(
  identity: string,
  meter: Meter,
  period: QuotaPeriod,
  now: number = Date.now(),
): number {
  const span = windowMs(period);
  const since = Number.isFinite(span) ? now - span : 0;
  return store.hits(identity, meter, since).length;
}

/** The raw hit timestamps, for "resets in…" messaging. */
export function hitsInPeriod(
  identity: string,
  meter: Meter,
  period: QuotaPeriod,
  now: number = Date.now(),
): number[] {
  const span = windowMs(period);
  const since = Number.isFinite(span) ? now - span : 0;
  return store.hits(identity, meter, since);
}

/** Count one carousel against an identity. */
export function recordUse(
  identity: string,
  meters: Meter[],
  now: number = Date.now(),
): () => void {
  for (const m of meters) store.record(identity, m, now);
  return () => {
    for (const m of meters) store.rollback(identity, m);
  };
}

export const QUOTA_CONSTANTS = { MINUTE, DAY, WEEK, MONTH };
