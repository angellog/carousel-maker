import { describe, expect, it } from "vitest";
import {
  PLANS,
  PLAN_ORDER,
  can,
  quotaLimit,
  quotaPeriod,
  quotaState,
  getPlan,
  upsellFor,
  FREE_LIFETIME_QUOTA,
  STARTER_MONTHLY_QUOTA,
  type Feature,
} from "@/lib/plan";

const ALL_FEATURES: Feature[] = [
  "customize",
  "inspiration",
  "hostedResearch",
  "brandKit",
  "unlimited",
  "noAttribution",
];

describe("plans & entitlements", () => {
  it("ships the four decided tiers in order", () => {
    expect(PLAN_ORDER).toEqual(["free", "starter", "pro", "lifetime"]);
    expect(PLANS.free.price).toBe("$0");
    expect(PLANS.starter.price).toBe("$5/mo");
    expect(PLANS.pro.price).toBe("$19/mo");
    expect(PLANS.lifetime.price).toBe("$59 once");
    expect(PLANS.lifetime.cadence).toBe("once");
  });

  it("free is a real 2-carousel lifetime trial with no customization, no watermark", () => {
    expect(quotaLimit("free")).toBe(FREE_LIFETIME_QUOTA);
    expect(quotaPeriod("free")).toBe("lifetime");
    expect(can("free", "customize")).toBe(false);
    expect(can("free", "inspiration")).toBe(false);
    expect(can("free", "unlimited")).toBe(false);
    expect(PLANS.free.perks.join(" ").toLowerCase()).toContain("no watermark");
  });

  it("starter is limited-but-customizable: monthly cap, customize + research + no-attribution, no Pro magic", () => {
    expect(quotaLimit("starter")).toBe(STARTER_MONTHLY_QUOTA);
    expect(quotaPeriod("starter")).toBe("month");
    for (const f of ["customize", "hostedResearch", "noAttribution"] as const) {
      expect(can("starter", f), f).toBe(true);
    }
    for (const f of ["inspiration", "brandKit", "unlimited"] as const) {
      expect(can("starter", f), f).toBe(false);
    }
  });

  it("pro unlocks everything and removes the cap", () => {
    expect(quotaLimit("pro")).toBe(Infinity);
    for (const f of ALL_FEATURES) expect(can("pro", f), f).toBe(true);
  });

  it("lifetime grants the same entitlements as pro, unlimited, one-time", () => {
    expect(quotaLimit("lifetime")).toBe(Infinity);
    for (const f of ALL_FEATURES) expect(can("lifetime", f), f).toBe(true);
    expect(quotaState("lifetime", 999).blocked).toBe(false);
  });

  it("unknown/undefined plan falls back to free", () => {
    expect(getPlan(undefined).id).toBe("free");
    expect(getPlan("enterprise").id).toBe("free");
    expect(can(undefined, "inspiration")).toBe(false);
  });

  it("quota math blocks free at its lifetime cap and never blocks unlimited plans", () => {
    const fresh = quotaState("free", 0);
    expect(fresh.remaining).toBe(FREE_LIFETIME_QUOTA);
    expect(fresh.blocked).toBe(false);

    const spent = quotaState("free", FREE_LIFETIME_QUOTA);
    expect(spent.remaining).toBe(0);
    expect(spent.blocked).toBe(true);

    const starterOverCap = quotaState("starter", STARTER_MONTHLY_QUOTA + 5);
    expect(starterOverCap.blocked).toBe(true);

    const pro = quotaState("pro", 999);
    expect(pro.unlimited).toBe(true);
    expect(pro.blocked).toBe(false);
  });

  it("every feature has upsell copy", () => {
    for (const f of ALL_FEATURES) expect(upsellFor(f).length).toBeGreaterThan(10);
  });
});
