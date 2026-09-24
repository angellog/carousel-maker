import { describe, expect, it } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  can,
  getPlan,
  hostedLimit,
  hostedPeriod,
  hostedState,
  periodLabel,
  quotaLimit,
  quotaPeriod,
  quotaState,
  upsellFor,
  FREE_WEEKLY_QUOTA,
  MAKER_HOSTED_MONTHLY_QUOTA,
  type Feature,
} from "@/lib/plan";

const CAPABILITY_FEATURES: Feature[] = ["customize", "inspiration", "hostedResearch", "brandKit"];

describe("plans & entitlements", () => {
  it("ships three plans: free, bring-your-own-key, and the one-time licence", () => {
    expect(PLAN_ORDER).toEqual(["free", "byok", "maker"]);
    expect(PLANS.free.price).toBe("$0");
    expect(PLANS.byok.price).toBe("$0");
    expect(PLANS.maker.price).toBe("$9 once");
    expect(PLANS.maker.cadence).toBe("once");
  });

  it("gives every capability away on every plan — the cap is the only caveat", () => {
    for (const plan of PLAN_ORDER) {
      for (const feature of CAPABILITY_FEATURES) {
        expect(can(plan, feature), `${plan} → ${feature}`).toBe(true);
      }
    }
  });

  it("free is two a week, on our engine", () => {
    expect(quotaLimit("free")).toBe(FREE_WEEKLY_QUOTA);
    expect(quotaPeriod("free")).toBe("week");
    expect(hostedLimit("free")).toBe(FREE_WEEKLY_QUOTA);
    expect(can("free", "unlimited")).toBe(false);
  });

  it("bring-your-own-key gets the same weekly cap and never touches our engine", () => {
    expect(quotaLimit("byok")).toBe(FREE_WEEKLY_QUOTA);
    expect(quotaPeriod("byok")).toBe("week");
    expect(hostedLimit("byok")).toBe(0);
    expect(can("byok", "unlimited")).toBe(false);
  });

  it("the licence lifts the cap and drops the credit, with a bounded hosted allowance", () => {
    expect(quotaLimit("maker")).toBe(Infinity);
    expect(can("maker", "unlimited")).toBe(true);
    expect(can("maker", "noAttribution")).toBe(true);
    expect(hostedLimit("maker")).toBe(MAKER_HOSTED_MONTHLY_QUOTA);
    expect(hostedPeriod("maker")).toBe("month");
  });

  it("keeps the caption credit on the free tiers — it is the distribution loop", () => {
    expect(can("free", "noAttribution")).toBe(false);
    expect(can("byok", "noAttribution")).toBe(false);
  });

  it("unknown or missing plan ids fall back to free, never to a paid plan", () => {
    expect(getPlan(undefined).id).toBe("free");
    expect(getPlan("enterprise").id).toBe("free");
    expect(can("enterprise", "unlimited")).toBe(false);
  });
});

describe("quota math", () => {
  it("counts down and blocks exactly at the limit", () => {
    expect(quotaState("free", 0)).toMatchObject({ remaining: 2, blocked: false });
    expect(quotaState("free", 1)).toMatchObject({ remaining: 1, blocked: false });
    expect(quotaState("free", 2)).toMatchObject({ remaining: 0, blocked: true });
  });

  it("never reports negative remaining, even if the counter overshoots", () => {
    expect(quotaState("free", 9).remaining).toBe(0);
    expect(quotaState("free", 9).blocked).toBe(true);
  });

  it("treats an unlimited plan as never blocked", () => {
    const s = quotaState("maker", 10_000);
    expect(s.unlimited).toBe(true);
    expect(s.blocked).toBe(false);
    expect(s.remaining).toBe(Infinity);
  });

  it("meters the hosted allowance separately from the licence cap", () => {
    expect(hostedState("maker", 29)).toMatchObject({ remaining: 1, blocked: false });
    expect(hostedState("maker", 30)).toMatchObject({ remaining: 0, blocked: true });
    // …while the licence cap is still unlimited.
    expect(quotaState("maker", 30).blocked).toBe(false);
  });

  it("ignores fractional and negative usage", () => {
    expect(quotaState("free", -3).used).toBe(0);
    expect(quotaState("free", 1.9).used).toBe(1);
  });
});

describe("wording", () => {
  it("labels periods so they read inside a sentence", () => {
    expect(periodLabel("week")).toBe("this week");
    expect(periodLabel("month")).toBe("this month");
  });

  it("never claims a capability is paid, because none are", () => {
    for (const f of CAPABILITY_FEATURES) {
      expect(upsellFor(f).toLowerCase()).toContain("free");
    }
    expect(upsellFor("unlimited")).toMatch(/licence/i);
  });
});
