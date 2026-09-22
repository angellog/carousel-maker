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

import { PRESETS } from "./presets";

export type PlanId = "free" | "starter" | "pro" | "lifetime";

export type Feature =
  /** Manual control of the look: pick any template, palette, voice and type
      scale — versus the free tier's Art Director auto-pick only. */
  | "customize"
  /** Upload a screenshot / paste a link → matched look (pure canvas math). */
  | "inspiration"
  /** The deeper keyless web-research tier by default (Wikipedia + DuckDuckGo). */
  | "hostedResearch"
  /** Save a reusable brand kit: palette, handle, default voice. */
  | "brandKit"
  /** No generation cap. */
  | "unlimited"
  /** Drop the small "made with Carousel Maker" line from the caption. */
  | "noAttribution";

export type QuotaPeriod = "day" | "week" | "month" | "lifetime";

/** How a plan is billed — drives the price display and the checkout path. */
export type Cadence = "free" | "month" | "once";

export interface PlanDef {
  id: PlanId;
  name: string;
  /** Display price; billing lives in Flutterwave (see docs/launch-readiness.md). */
  price: string;
  /** "free" · "month" (subscription) · "once" (one-time, e.g. Lifetime). */
  cadence: Cadence;
  tagline: string;
  /** Generations allowed per `quotaPeriod`. Infinity for unlimited. */
  quota: number;
  /** The window the quota resets on. */
  quotaPeriod: QuotaPeriod;
  features: ReadonlySet<Feature>;
  /** Short bullets shown on the upgrade surface. */
  perks: string[];
}

/** Free is a genuine trial: two great carousels, ever (never resets). */
export const FREE_LIFETIME_QUOTA = 2;
/** Starter's monthly allowance. */
export const STARTER_MONTHLY_QUOTA = 30;

const FREE_FEATURES: Feature[] = [];
const STARTER_FEATURES: Feature[] = ["customize", "hostedResearch", "noAttribution"];
const PRO_FEATURES: Feature[] = [
  "customize",
  "inspiration",
  "hostedResearch",
  "brandKit",
  "unlimited",
  "noAttribution",
];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "free",
    tagline: "Try it — two carousels, on the house.",
    quota: FREE_LIFETIME_QUOTA,
    quotaPeriod: "lifetime",
    features: new Set(FREE_FEATURES),
    perks: [
      `${FREE_LIFETIME_QUOTA} carousels to try (lifetime)`,
      "Art Director auto-picks your look",
      "Full-resolution 4:5 export, no watermark",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: "$5/mo",
    cadence: "month",
    tagline: "Make it yours, on a budget.",
    quota: STARTER_MONTHLY_QUOTA,
    quotaPeriod: "month",
    features: new Set(STARTER_FEATURES),
    perks: [
      `${STARTER_MONTHLY_QUOTA} carousels a month`,
      `Full customization: any of ${PRESETS.length} templates, palettes & voices`,
      "Deeper web research, no key needed",
      "No attribution line",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    cadence: "month",
    tagline: "For creators who post on a schedule.",
    quota: Infinity,
    quotaPeriod: "month",
    features: new Set(PRO_FEATURES),
    perks: [
      "Unlimited carousels",
      "Everything in Starter",
      "Inspiration: match any look you love",
      "Brand Kit: your palette, handle & voice saved",
    ],
  },
  lifetime: {
    id: "lifetime",
    name: "Lifetime",
    price: "$59 once",
    cadence: "once",
    tagline: "All of Pro, forever — one payment.",
    quota: Infinity,
    quotaPeriod: "lifetime",
    features: new Set(PRO_FEATURES),
    perks: [
      "Everything in Pro, forever",
      "One payment — no subscription",
      "Unlimited carousels",
      "All future templates & features",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "lifetime"];

export function getPlan(id: string | undefined): PlanDef {
  return PLANS[(id ?? "free") as PlanId] ?? PLANS.free;
}

/** Does this plan include a feature? */
export function can(plan: string | undefined, feature: Feature): boolean {
  return getPlan(plan).features.has(feature);
}

/** Generation allowance for a plan, per its quota period. */
export function quotaLimit(plan: string | undefined): number {
  return getPlan(plan).quota;
}

/** The window a plan's quota resets on ("day" | "week"). */
export function quotaPeriod(plan: string | undefined): QuotaPeriod {
  return getPlan(plan).quotaPeriod;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** True when the user has hit the cap and must wait or upgrade. */
  blocked: boolean;
  unlimited: boolean;
}

/** Pure quota math; the UI supplies the count used in the current period. */
export function quotaState(plan: string | undefined, usedInPeriod: number): QuotaState {
  const limit = quotaLimit(plan);
  const unlimited = !Number.isFinite(limit);
  const used = Math.max(0, Math.floor(usedInPeriod));
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return { used, limit, remaining, blocked: !unlimited && remaining <= 0, unlimited };
}

/** The single feature that most motivates an upgrade from a given context. */
export function upsellFor(feature: Feature): string {
  switch (feature) {
    case "customize":
      return "Choose your own template, palette and voice — upgrade to customize every deck.";
    case "inspiration":
      return "Match any carousel look you love — Pro reads its palette and layout and matches it.";
    case "hostedResearch":
      return "Get the deeper web-research tier by default, without bringing your own API key.";
    case "brandKit":
      return "Save your palette, handle and voice so every deck is on-brand in one tap.";
    case "unlimited":
      return "You've used this week's free carousels. Go unlimited with Pro.";
    case "noAttribution":
      return "Remove the attribution line from your caption.";
  }
}
