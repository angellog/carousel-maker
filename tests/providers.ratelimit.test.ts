import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientIdFromHeaders,
  rateLimitConfigFromEnv,
  resetRateLimit,
  type RateLimitConfig,
} from "@/lib/providers/ratelimit";

const cfg: RateLimitConfig = { perMinute: 3, perDay: 5, perWeek: Infinity, dailyBudget: 8, disabled: false };

beforeEach(() => resetRateLimit());

/** A controllable clock so tests never sleep. */
function clockAt(ms: { v: number }) {
  return () => ms.v;
}

describe("checkRateLimit — per-client windows", () => {
  it("allows up to the per-minute limit, then blocks", () => {
    const t = { v: 1_000_000 };
    const clock = clockAt(t);
    for (let i = 0; i < cfg.perMinute; i++) {
      expect(checkRateLimit("1.1.1.1", cfg, clock).ok).toBe(true);
    }
    const blocked = checkRateLimit("1.1.1.1", cfg, clock);
    expect(blocked.ok).toBe(false);
    expect(blocked.limit).toBe("minute");
    expect(blocked.retryAfter).toBe(60);
  });

  it("recovers after the minute window slides", () => {
    const t = { v: 1_000_000 };
    const clock = clockAt(t);
    for (let i = 0; i < cfg.perMinute; i++) checkRateLimit("2.2.2.2", cfg, clock);
    expect(checkRateLimit("2.2.2.2", cfg, clock).ok).toBe(false);
    t.v += 61_000; // a minute later
    expect(checkRateLimit("2.2.2.2", cfg, clock).ok).toBe(true);
  });

  it("enforces a per-day ceiling independent of the minute window", () => {
    const t = { v: 5_000_000 };
    const clock = clockAt(t);
    let allowed = 0;
    for (let i = 0; i < 20; i++) {
      const d = checkRateLimit("3.3.3.3", cfg, clock);
      if (d.ok) allowed++;
      else {
        expect(d.limit === "minute" || d.limit === "day").toBe(true);
      }
      t.v += 30_000; // 30s apart → never trips the minute window
    }
    expect(allowed).toBe(cfg.perDay);
  });

  it("isolates clients from each other", () => {
    const clock = clockAt({ v: 9_000_000 });
    for (let i = 0; i < cfg.perMinute; i++) checkRateLimit("a", cfg, clock);
    expect(checkRateLimit("a", cfg, clock).ok).toBe(false);
    expect(checkRateLimit("b", cfg, clock).ok).toBe(true);
  });
});

describe("checkRateLimit — weekly free ceiling", () => {
  it("enforces a per-week cap that outlives the day window", () => {
    // Free tier: 2 per week. Space hits days apart so minute/day never trip.
    const week: RateLimitConfig = { perMinute: 100, perDay: 100, perWeek: 2, dailyBudget: 100, disabled: false };
    const t = { v: 1_000_000_000 };
    const clock = clockAt(t);
    expect(checkRateLimit("w", week, clock).ok).toBe(true);
    t.v += 2 * 86_400_000; // 2 days later
    expect(checkRateLimit("w", week, clock).ok).toBe(true);
    t.v += 2 * 86_400_000; // 2 more days (still within the same 7-day window)
    const blocked = checkRateLimit("w", week, clock);
    expect(blocked.ok).toBe(false);
    expect(blocked.limit).toBe("week");
    // After the rolling week clears the first hits, a slot frees again.
    t.v += 4 * 86_400_000; // now the first hit is > 7 days old
    expect(checkRateLimit("w", week, clock).ok).toBe(true);
  });

  it("is disabled by default (Infinity), so no weekly cap unless configured", () => {
    const noWeek: RateLimitConfig = { perMinute: 100, perDay: 100, perWeek: Infinity, dailyBudget: 100, disabled: false };
    const clock = clockAt({ v: 1000 });
    for (let i = 0; i < 20; i++) expect(checkRateLimit("nw", noWeek, clock).ok).toBe(true);
  });
});

describe("checkRateLimit — global budget", () => {
  it("caps total spend across all clients", () => {
    const t = { v: 2_000_000 };
    const clock = clockAt(t);
    let allowed = 0;
    for (let i = 0; i < 40; i++) {
      const d = checkRateLimit(`client-${i}`, cfg, clock); // unique client each time
      if (d.ok) allowed++;
      else expect(d.limit).toBe("budget");
      t.v += 1000;
    }
    // Distinct clients never hit per-client limits, so the global budget is the wall.
    expect(allowed).toBe(cfg.dailyBudget);
  });
});

describe("checkRateLimit — disabled + rollback", () => {
  it("never blocks when disabled", () => {
    const c = { ...cfg, disabled: true };
    const clock = clockAt({ v: 0 });
    for (let i = 0; i < 100; i++) expect(checkRateLimit("x", c, clock).ok).toBe(true);
  });

  it("rollback refunds a counted slot", () => {
    const clock = clockAt({ v: 1234 });
    // Use the slot, then roll it back — the client should be back to zero.
    const first = checkRateLimit("r", cfg, clock);
    first.rollback();
    let allowed = 0;
    for (let i = 0; i < cfg.perMinute; i++) if (checkRateLimit("r", cfg, clock).ok) allowed++;
    expect(allowed).toBe(cfg.perMinute); // full budget still available after rollback
  });
});

describe("rateLimitConfigFromEnv", () => {
  it("reads overrides and falls back to defaults", () => {
    const c = rateLimitConfigFromEnv({ CAROUSEL_RATE_PER_MIN: "9", CAROUSEL_RATE_DISABLED: "1" });
    expect(c.perMinute).toBe(9);
    expect(c.perDay).toBe(50); // default
    expect(c.perWeek).toBe(Infinity); // no weekly cap unless set
    expect(c.disabled).toBe(true);
  });

  it("reads a weekly cap when set", () => {
    expect(rateLimitConfigFromEnv({ CAROUSEL_RATE_PER_WEEK: "2" }).perWeek).toBe(2);
  });
});

describe("clientIdFromHeaders", () => {
  it("prefers the first x-forwarded-for hop", () => {
    const h = new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" });
    expect(clientIdFromHeaders(h)).toBe("9.9.9.9");
  });
  it("falls back to a shared bucket when unidentified", () => {
    expect(clientIdFromHeaders(new Headers())).toBe("anonymous");
  });
});
