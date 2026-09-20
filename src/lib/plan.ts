/**
 * Plans & entitlements — the freemium spine.
 *
 * Design principle: the free tier must produce genuinely great, unwatermarked
 * carousels, or nobody trusts the tool enough to pay for it. So Pro never
 * degrades output quality. It removes friction (unlimited runs, no attribution
 * line), unlocks the magic (Inspiration, Brand Kit), and covers the paid brain
 * (hosted live-web research so a creator needn't bring their own key).
 *
 * This module is the single source of truth for what each plan can do. It is
 * pure and deterministic; the UI reads it to gate features and the server reads
 * it to authorise paid actions. Billing/accounts are wired separately — see
 * docs/PRODUCT.md ("Wiring payments"); this layer defines the entitlements a
 * verified plan grants, not how the plan is proven.
 */

export type PlanId = "free" | "pro";

export type Feature =
  /** Upload a screenshot / paste a link → matched look (pure canvas math). */
  | "inspiration"
  /** Live web research on our hosted key — no bring-your-own-key needed. */
  | "hostedResearch"
  /** Save a reusable brand kit: palette, handle, default voice. */
  | "brandKit"
  /** Cloud project library: save, reopen, sync decks. */
  | "projectLibrary"
  /** No daily generation cap. */
  | "unlimited"
  /** Extra export ratios beyond 4:5 (1:1 square, 9:16 story). */
  | "extraFormats"
  /** Drop the small "made with Carousel Maker" line from the caption. */
  | "noAttribution";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Display price; the number is informational, billing lives elsewhere. */
  price: string;
  tagline: string;
  /** Generations allowed per day. Infinity for unlimited. */
  dailyQuota: number;
  features: ReadonlySet<Feature>;
  /** Short bullets shown on the upgrade surface. */
  perks: string[];
}

export const FREE_DAILY_QUOTA = 3;

const FREE_FEATURES: Feature[] = [];
const PRO_FEATURES: Feature[] = [
  "inspiration",
  "hostedResearch",
  "brandKit",
  "projectLibrary",
  "unlimited",
  "extraFormats",
  "noAttribution",
];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    tagline: "Everything you need to post a great carousel.",
    dailyQuota: FREE_DAILY_QUOTA,
    features: new Set(FREE_FEATURES),
    perks: [
      "All 12 winning templates",
      "All 5 writer voices",
      "Art Director auto-pick",
      "Keyless research, or bring your own key",
      `${FREE_DAILY_QUOTA} carousels a day`,
      "Full-resolution 4:5 export, no watermark",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$8/mo",
    tagline: "For creators who post on a schedule.",
    dailyQuota: Infinity,
    features: new Set(PRO_FEATURES),
    perks: [
      "Unlimited carousels",
      "Inspiration: match any look you love",
      "Live web research, no key needed",
      "Brand Kit: your palette, handle & voice saved",
      "Project library: save, reopen, sync",
      "Square & story exports",
      "No attribution line",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro"];

export function getPlan(id: string | undefined): PlanDef {
  return PLANS[(id ?? "free") as PlanId] ?? PLANS.free;
}

/** Does this plan include a feature? */
export function can(plan: string | undefined, feature: Feature): boolean {
  return getPlan(plan).features.has(feature);
}

/** Daily generation allowance for a plan. */
export function dailyQuota(plan: string | undefined): number {
  return getPlan(plan).dailyQuota;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** True when the user has hit the cap and must wait or upgrade. */
  blocked: boolean;
  unlimited: boolean;
}

/** Pure quota math; the UI supplies today's count (from local storage or server). */
export function quotaState(plan: string | undefined, usedToday: number): QuotaState {
  const limit = dailyQuota(plan);
  const unlimited = !Number.isFinite(limit);
  const used = Math.max(0, Math.floor(usedToday));
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return { used, limit, remaining, blocked: !unlimited && remaining <= 0, unlimited };
}

/** The single feature that most motivates an upgrade from a given context. */
export function upsellFor(feature: Feature): string {
  switch (feature) {
    case "inspiration":
      return "Match any carousel look you love — Pro reads its palette and layout and matches it.";
    case "hostedResearch":
      return "Get live web research without bringing your own API key.";
    case "brandKit":
      return "Save your palette, handle and voice so every deck is on-brand in one tap.";
    case "projectLibrary":
      return "Save decks to your library and reopen them on any device.";
    case "unlimited":
      return "You've used today's free carousels. Go unlimited with Pro.";
    case "extraFormats":
      return "Export square and story sizes, not just 4:5.";
    case "noAttribution":
      return "Remove the attribution line from your caption.";
  }
}
