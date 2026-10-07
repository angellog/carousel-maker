/**
 * The production environment contract.
 *
 * Two distinct things are tested here, and the second one is the point:
 *
 *   1. That `assertProductionEnv` says the right thing about a given env — the
 *      ordinary unit tests.
 *   2. That the contract is still *about* the code it claims to protect. A
 *      contract naming `CAROUSEL_RATE_PER_WEEK` is worthless the day someone
 *      renames that variable in `ratelimit.ts`: the assertion keeps passing, the
 *      deploy keeps going green, and the weekly cap quietly stops existing
 *      again. So the last block feeds a contract-satisfying env to the real
 *      readers and asserts the hole is actually closed, then removes the
 *      variable and asserts the hole re-opens. If either direction stops
 *      holding, the contract has drifted off the code and these tests fail.
 */

import { describe, expect, it } from "vitest";
import {
  PRODUCTION_ENV_CONTRACT,
  assertProductionEnv,
  checkProductionEnv,
  isProductionServer,
} from "@/lib/env/require";
import { rateLimitConfigFromEnv } from "@/lib/providers/ratelimit";
import { turnstileSecretFromEnv } from "@/lib/turnstile";
import { flutterwaveConfigFromEnv } from "@/lib/billing/flutterwave";

/** A production environment that satisfies the contract. Values are fabricated. */
function completeEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    CAROUSEL_RATE_PER_WEEK: "2",
    CAROUSEL_DAILY_BUDGET: "500",
    TURNSTILE_SECRET: "0x-turnstile-secret",
    CAROUSEL_LICENSE_SECRET: "a-long-random-licence-signing-secret",
    CAROUSEL_LICENSE_LEDGER: "/data/licences.jsonl",
    FLW_PUBLIC_KEY: "FLWPUBK-fake",
    FLW_SECRET_KEY: "FLWSECK-fake",
    FLW_SECRET_HASH: "fake-webhook-hash",
  };
}

const REQUIRED = PRODUCTION_ENV_CONTRACT.filter((r) => r.rule === "required").map((r) => r.name);

describe("the production env contract", () => {
  it("passes a fully configured production environment", () => {
    expect(assertProductionEnv(completeEnv())).toEqual([]);
  });

  it("covers every variable the audit found, so nothing silently drops out of the contract", () => {
    // A named list, not a count: a count is satisfied by any ten names, which is
    // exactly how a variable gets quietly swapped out of an enforced contract.
    expect([...PRODUCTION_ENV_CONTRACT].map((r) => r.name).sort()).toEqual(
      [
        "CAROUSEL_DAILY_BUDGET",
        "CAROUSEL_LICENSE_DEV_UNLOCK",
        "CAROUSEL_LICENSE_LEDGER",
        "CAROUSEL_LICENSE_SECRET",
        "CAROUSEL_RATE_DISABLED",
        "CAROUSEL_RATE_PER_WEEK",
        "FLW_PUBLIC_KEY",
        "FLW_SECRET_HASH",
        "FLW_SECRET_KEY",
        "TURNSTILE_SECRET",
      ].sort(),
    );
  });

  it.each(REQUIRED)("refuses a production boot with %s missing, and names it", (name) => {
    const env = completeEnv();
    delete env[name];
    const problems = assertProductionEnv(env);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(name);
    // The message has to say what breaks, not just that something is unset — a
    // deploy log that reads "TURNSTILE_SECRET is not set" tells an operator at
    // 2am nothing about whether it is safe to ignore for now.
    expect(problems[0].length).toBeGreaterThan(name.length + 40);
  });

  it.each(REQUIRED)("treats a blank %s as missing, because every reader trims first", (name) => {
    const env = completeEnv();
    env[name] = "   \t ";
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining(name)]);
  });

  it("reports every problem at once, so a broken deploy takes one restart and not seven", () => {
    const problems = assertProductionEnv({ NODE_ENV: "production" });
    expect(problems).toHaveLength(REQUIRED.length);
    for (const name of REQUIRED) {
      expect(problems.some((p) => p.startsWith(name))).toBe(true);
    }
  });

  it("never echoes a value, only names — this output goes to a deploy log and to /api/health", () => {
    const env = completeEnv();
    env.CAROUSEL_RATE_PER_WEEK = "not-a-number";
    env.CAROUSEL_LICENSE_DEV_UNLOCK = "1";
    env.CAROUSEL_RATE_DISABLED = "true";
    const text = assertProductionEnv(env).join("\n");
    expect(text).not.toContain("not-a-number");
    for (const secret of Object.values(completeEnv())) {
      if (secret && secret !== "production") expect(text).not.toContain(secret);
    }
  });
});

describe("values that are present but unusable", () => {
  // `rateLimitConfigFromEnv` discards anything that isn't a finite number >= 0
  // and falls back to its default. For CAROUSEL_RATE_PER_WEEK that default is
  // Infinity — so "set to junk" is byte-for-byte as fail-open as "not set", and
  // a presence-only check would wave it through.
  it.each(["", "two", "NaN", "-1", "1e", "Infinity"])(
    "rejects CAROUSEL_RATE_PER_WEEK=%j, which the reader would silently discard",
    (value) => {
      const env = { ...completeEnv(), CAROUSEL_RATE_PER_WEEK: value };
      expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_RATE_PER_WEEK")]);
    },
  );

  it("rejects a fractional weekly cap", () => {
    const env = { ...completeEnv(), CAROUSEL_RATE_PER_WEEK: "2.5" };
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_RATE_PER_WEEK")]);
  });

  it("accepts 0 as a weekly cap — a deliberate 'no free generations at all'", () => {
    expect(assertProductionEnv({ ...completeEnv(), CAROUSEL_RATE_PER_WEEK: "0" })).toEqual([]);
  });

  it("rejects a junk daily budget the same way", () => {
    const env = { ...completeEnv(), CAROUSEL_DAILY_BUDGET: "lots" };
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_DAILY_BUDGET")]);
  });
});

describe("switches that must be off", () => {
  it.each(["1", "true"])(
    "refuses CAROUSEL_RATE_DISABLED=%j — the reader honours it, and it switches off the daily budget too",
    (value) => {
      expect(rateLimitConfigFromEnv({ CAROUSEL_RATE_DISABLED: value }).disabled).toBe(true);
      const env = { ...completeEnv(), CAROUSEL_RATE_DISABLED: value };
      expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_RATE_DISABLED")]);
    },
  );

  it.each(["TRUE", " true "])(
    "also refuses CAROUSEL_RATE_DISABLED=%j, which the reader does NOT honour",
    (value) => {
      // These spellings leave the limiter on today — the reader compares against
      // the exact strings "1" and "true". We refuse them anyway: whoever wrote
      // them meant to disable spend protection, and a near-miss that silently
      // does the opposite of what the operator intended is its own bug. Refusing
      // makes the mistake visible in one deploy log line.
      expect(rateLimitConfigFromEnv({ CAROUSEL_RATE_DISABLED: value }).disabled).toBe(false);
      const env = { ...completeEnv(), CAROUSEL_RATE_DISABLED: value };
      expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_RATE_DISABLED")]);
    },
  );

  it.each(["0", "false", undefined])("allows CAROUSEL_RATE_DISABLED=%j", (value) => {
    // Unset is the safe state and `0` is the documented off-spelling in
    // .env.example, so an operator who wrote it explicitly is saying "limiter
    // on" — which is what we want. Only the spellings the reader honours as
    // truthy are refused.
    expect(assertProductionEnv({ ...completeEnv(), CAROUSEL_RATE_DISABLED: value })).toEqual([]);
  });

  it.each(["1", "0", "false", "yes"])(
    "refuses CAROUSEL_LICENSE_DEV_UNLOCK=%j — absence, not merely off",
    (value) => {
      // Deliberately stricter than CAROUSEL_RATE_DISABLED. `=0` is inert in the
      // redeem route today (it compares against "1"), but a dev-only free
      // licence minter has no legitimate spelling on a production box at all,
      // and "must be absent" is an invariant an operator can check at a glance
      // while "must be absent or one of these falsy spellings" is not.
      const env = { ...completeEnv(), CAROUSEL_LICENSE_DEV_UNLOCK: value };
      expect(assertProductionEnv(env)).toEqual([
        expect.stringContaining("CAROUSEL_LICENSE_DEV_UNLOCK"),
      ]);
    },
  );

  it("passes when CAROUSEL_LICENSE_DEV_UNLOCK is absent", () => {
    const env = completeEnv();
    expect(env.CAROUSEL_LICENSE_DEV_UNLOCK).toBeUndefined();
    expect(assertProductionEnv(env)).toEqual([]);
  });
});

describe("checkProductionEnv, which /api/health renders", () => {
  it("reports every contract variable in contract order, passing ones included", () => {
    const report = checkProductionEnv(completeEnv());
    expect(report.ok).toBe(true);
    expect(report.vars.map((v) => v.name)).toEqual(PRODUCTION_ENV_CONTRACT.map((r) => r.name));
    expect(report.vars.every((v) => v.ok)).toBe(true);
    expect(report.vars.every((v) => v.problem === undefined)).toBe(true);
  });

  it("marks only the broken variable, and carries the problem on it", () => {
    const env = completeEnv();
    delete env.TURNSTILE_SECRET;
    const report = checkProductionEnv(env);
    expect(report.ok).toBe(false);
    const failed = report.vars.filter((v) => !v.ok);
    expect(failed.map((v) => v.name)).toEqual(["TURNSTILE_SECRET"]);
    expect(failed[0].problem).toContain("TURNSTILE_SECRET");
  });
});

describe("when the contract applies at all", () => {
  it("is not enforced in development or test, so dev and this suite boot untouched", () => {
    expect(isProductionServer({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionServer({ NODE_ENV: "test" })).toBe(false);
    expect(isProductionServer({})).toBe(false);
  });

  it("is enforced on a production server process", () => {
    expect(isProductionServer({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionServer({ NODE_ENV: "production", NEXT_RUNTIME: "nodejs" })).toBe(true);
  });

  it("is NOT enforced in the edge runtime, which cannot exit and cannot see the full env", () => {
    // `next build` emits .next/server/edge-instrumentation.js regardless of
    // whether anything uses the edge runtime. Nothing runs it today — every
    // route is runtime = "nodejs" and there is no middleware.ts — but the day
    // someone adds middleware, this hook starts executing in a V8 isolate with
    // no process.exit and a partial environment. Left unguarded it would report
    // variables as missing that are set, then throw trying to exit.
    expect(isProductionServer({ NODE_ENV: "production", NEXT_RUNTIME: "edge" })).toBe(false);
  });

  it.each(["phase-production-build", "phase-export"])(
    "is NOT enforced during %s — `next build` runs with NODE_ENV=production and loads this hook",
    (phase) => {
      // Without this, the Docker build itself would fail: the build has no
      // Flutterwave keys and no licence ledger, and it does not need them. This
      // is the exact trap that keeps the check out of next.config.ts.
      expect(isProductionServer({ NODE_ENV: "production", NEXT_PHASE: phase })).toBe(false);
    },
  );
});

describe("the contract still describes the code it protects", () => {
  it("closes the weekly-cap hole: a contract-satisfying env yields a finite perWeek", () => {
    const env = completeEnv();
    expect(assertProductionEnv(env)).toEqual([]);
    const cfg = rateLimitConfigFromEnv(env);
    expect(Number.isFinite(cfg.perWeek)).toBe(true);
    expect(cfg.perWeek).toBe(2);
    expect(cfg.disabled).toBe(false);
    expect(cfg.dailyBudget).toBe(500);
  });

  it("re-opens the weekly-cap hole the moment the variable goes away", () => {
    // The negative half. If this ever passes with the variable removed, the
    // ratelimit default changed and the contract entry is now theatre.
    const env = completeEnv();
    delete env.CAROUSEL_RATE_PER_WEEK;
    expect(rateLimitConfigFromEnv(env).perWeek).toBe(Infinity);
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining("CAROUSEL_RATE_PER_WEEK")]);
  });

  it("closes the bot-shield hole, and re-opens it when the secret goes away", () => {
    const env = completeEnv();
    expect(turnstileSecretFromEnv(env)).toBe("0x-turnstile-secret");
    delete env.TURNSTILE_SECRET;
    expect(turnstileSecretFromEnv(env)).toBeUndefined();
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining("TURNSTILE_SECRET")]);
  });

  it("keeps the payment path configured, and names the key that kills it", () => {
    const env = completeEnv();
    expect(flutterwaveConfigFromEnv(env)).toBeTruthy();
    delete env.FLW_SECRET_KEY;
    expect(flutterwaveConfigFromEnv(env)).toBeFalsy();
    expect(assertProductionEnv(env)).toEqual([expect.stringContaining("FLW_SECRET_KEY")]);
  });
});
