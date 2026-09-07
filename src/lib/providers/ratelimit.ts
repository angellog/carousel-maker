/**
 * Spend protection for the modes where *we* pay (a server Anthropic key, or a
 * hosted open-source key). Without this, a single public endpoint holding our
 * key is an unbounded bill: one script in a loop spends real money with no
 * ceiling. This is the guardrail that makes "hosted, our key" safe to expose.
 *
 * Three limits, each independent — the first one hit wins:
 *   - per-client per-minute  (burst control, catches a hammering client)
 *   - per-client per-day     (fair-use ceiling per visitor)
 *   - global per-day budget  (the hard cap on our total spend for the day)
 *
 * Bring-your-own-key and the keyless template writer are never limited here:
 * BYOK spends the user's own money, and the template writer spends nobody's.
 *
 * The default store is in-memory, which is correct and sufficient for a single
 * instance. Behind several instances, inject a shared store (Redis, etc.) via
 * `setRateLimitStore` so the counters are global; the interface is deliberately
 * tiny so that swap is a few lines. See docs/PROVIDERS.md.
 */

export interface RateLimitConfig {
  perMinute: number;
  perDay: number;
  /** Hard ceiling on total paid generations across all clients per day. */
  dailyBudget: number;
  disabled: boolean;
}

export function rateLimitConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const num = (v: string | undefined, d: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    perMinute: num(env.CAROUSEL_RATE_PER_MIN, 5),
    perDay: num(env.CAROUSEL_RATE_PER_DAY, 50),
    dailyBudget: num(env.CAROUSEL_DAILY_BUDGET, 500),
    disabled: env.CAROUSEL_RATE_DISABLED === "1" || env.CAROUSEL_RATE_DISABLED === "true",
  };
}

export interface RateDecision {
  ok: boolean;
  /** Seconds to wait before retrying, when known. */
  retryAfter?: number;
  /** A short, user-facing explanation when blocked. */
  message?: string;
  /** Which limit tripped, for logging/telemetry. */
  limit?: "minute" | "day" | "budget";
}

/** A monotonic-ish clock, injectable so tests don't sleep. */
export type Clock = () => number;

interface Hit {
  ts: number;
}

/**
 * The pluggable counter store. `record` appends a hit for a client and returns
 * the current counts within the given windows; `globalToday` returns the total
 * paid generations counted so far in the current UTC day.
 */
export interface RateLimitStore {
  record(clientId: string, now: number): { lastMinute: number; lastDay: number; globalDay: number };
  /** Undo the most recent hit for a client — used when the request never ran. */
  rollback(clientId: string, now: number): void;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Default in-memory store. Prunes lazily so memory stays bounded. */
export class MemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, Hit[]>();
  private global: Hit[] = [];

  record(clientId: string, now: number) {
    const arr = this.hits.get(clientId) ?? [];
    // Drop anything older than a day for this client.
    const dayAgo = now - DAY;
    const pruned = arr.filter((h) => h.ts > dayAgo);
    pruned.push({ ts: now });
    this.hits.set(clientId, pruned);

    this.global = this.global.filter((h) => h.ts > dayAgo);
    this.global.push({ ts: now });

    const minuteAgo = now - MINUTE;
    return {
      lastMinute: pruned.filter((h) => h.ts > minuteAgo).length,
      lastDay: pruned.length,
      globalDay: this.global.length,
    };
  }

  rollback(clientId: string, now: number) {
    const arr = this.hits.get(clientId);
    if (arr && arr.length) arr.pop();
    // Remove the newest global hit (the one we just added for this client).
    if (this.global.length) this.global.pop();
    void now;
  }
}

let store: RateLimitStore = new MemoryRateLimitStore();

/** Swap the counter store (e.g. a Redis-backed one for multi-instance). */
export function setRateLimitStore(s: RateLimitStore): void {
  store = s;
}

/** Reset to a fresh in-memory store. Test helper. */
export function resetRateLimit(): void {
  store = new MemoryRateLimitStore();
}

/**
 * Count one paid generation for `clientId` and decide whether it is allowed.
 * Call this exactly once per paid request, before doing the work. If the work
 * then fails to start, call the returned `rollback` so the client is not
 * charged a slot for nothing.
 */
export function checkRateLimit(
  clientId: string,
  cfg: RateLimitConfig,
  clock: Clock = Date.now,
): RateDecision & { rollback: () => void } {
  const noop = () => {};
  if (cfg.disabled) return { ok: true, rollback: noop };

  const now = clock();
  const counts = store.record(clientId, now);
  const rollback = () => store.rollback(clientId, now);

  if (counts.globalDay > cfg.dailyBudget) {
    rollback();
    return {
      ok: false,
      limit: "budget",
      retryAfter: secondsToMidnightUTC(now),
      message: "The free hosted tier has hit its daily limit. Add your own API key under Options → API key to keep going now.",
      rollback: noop,
    };
  }
  if (counts.lastMinute > cfg.perMinute) {
    rollback();
    return {
      ok: false,
      limit: "minute",
      retryAfter: 60,
      message: "You're going a little fast — wait a minute and try again, or add your own API key to skip the limit.",
      rollback: noop,
    };
  }
  if (counts.lastDay > cfg.perDay) {
    rollback();
    return {
      ok: false,
      limit: "day",
      retryAfter: secondsToMidnightUTC(now),
      message: "You've reached today's free generation limit. It resets tomorrow, or add your own API key under Options → API key.",
      rollback: noop,
    };
  }
  return { ok: true, rollback };
}

function secondsToMidnightUTC(now: number): number {
  const next = Math.floor(now / DAY) * DAY + DAY;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * Best-effort client identity from request headers. Prefers the standard proxy
 * headers so it works behind Vercel/nginx; falls back to a shared bucket when
 * nothing identifies the caller (which just means stricter shared limits).
 */
export function clientIdFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "anonymous"
  );
}
