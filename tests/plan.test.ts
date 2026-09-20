import { describe, expect, it } from "vitest";
import {
  PLANS,
  can,
  dailyQuota,
  quotaState,
  getPlan,
  upsellFor,
  FREE_DAILY_QUOTA,
} from "@/lib/plan";

describe("plans & entitlements", () => {
  it("free is genuinely usable: templates/voices/art-director, capped runs, no watermark", () => {
    // Free grants none of the paid features, but the quota is real and finite.
    expect(dailyQuota("free")).toBe(FREE_DAILY_QUOTA);
    expect(can("free", "inspiration")).toBe(false);
    expect(can("free", "unlimited")).toBe(false);
    // Perks copy promises no watermark (quality is never the paywall).
    expect(PLANS.free.perks.join(" ").toLowerCase()).toContain("no watermark");
  });

  it("pro unlocks the magic and removes the cap", () => {
    expect(dailyQuota("pro")).toBe(Infinity);
    for (const f of ["inspiration", "hostedResearch", "brandKit", "unlimited", "noAttribution"] as const) {
      expect(can("pro", f)).toBe(true);
    }
  });

  it("unknown/undefined plan falls back to free", () => {
    expect(getPlan(undefined).id).toBe("free");
    expect(getPlan("enterprise").id).toBe("free");
    expect(can(undefined, "inspiration")).toBe(false);
  });

  it("quota math blocks free at the cap and never blocks pro", () => {
    const fresh = quotaState("free", 0);
    expect(fresh.remaining).toBe(FREE_DAILY_QUOTA);
    expect(fresh.blocked).toBe(false);

    const spent = quotaState("free", FREE_DAILY_QUOTA);
    expect(spent.remaining).toBe(0);
    expect(spent.blocked).toBe(true);

    const over = quotaState("free", 999);
    expect(over.remaining).toBe(0);
    expect(over.blocked).toBe(true);

    const pro = quotaState("pro", 999);
    expect(pro.unlimited).toBe(true);
    expect(pro.blocked).toBe(false);
  });

  it("every feature has upsell copy", () => {
    for (const f of ["inspiration", "hostedResearch", "brandKit", "unlimited", "noAttribution"] as const) {
      expect(upsellFor(f).length).toBeGreaterThan(10);
    }
  });
});
