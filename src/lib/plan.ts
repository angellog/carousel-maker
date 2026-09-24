/**
 * Plans & entitlements — the monetization spine.
 *
 * The model, in one paragraph: **every feature is free.** The Art Director,
 * all templates, all voices, Inspiration, Brand Kit, full-resolution export —
 * nothing is held back, because a tool that cripples its free output never
 * earns the word of mouth it needs. What you buy with the one-time Maker
 * licence is *consistency*: the right to keep making carousels past the free
 * weekly allowance.
 *
 * Two axes, because two different scarcities exist:
 *
 *   1. **Licence cap** (`quota`) — how many carousels this plan may make in a
 *      period, no matter whose key pays for the words. This is the thing the
 *      $9 buys. It applies even to bring-your-own-key users: they pay for the
 *      compute, the licence pays for the software.
 *   2. **Hosted allowance** (`hostedQuota`) — how many of those may run on
 *      *our* embedded key, which costs us real money. Free users have one
 *      because they have no other way in; licence holders get a monthly
 *      allowance so that a creator with no API key is still a first-class
 *      customer.
 *
 * This module is pure and deterministic. The UI reads it to phrase things; the
 * server reads it to authorise (see `src/lib/access`). Entitlement *definition*
 * lives here; entitlement *proof* is a signed licence — never localStorage.
 */

import { PRESETS } from "./presets";

export type PlanId = "free" | "byok" | "maker";

export type Feature =
  /** Manual control of the look: any template, palette, voice, type scale. */
  | "customize"
  /** Upload a screenshot → matched look (pure canvas math). */
  | "inspiration"
  /** The deeper keyless web-research tier by default. */
  | "hostedResearch"
  /** Save a reusable brand kit: palette, handle, default voice. */
  | "brandKit"
  /** No licence cap — make as many as you like. */
  | "unlimited"
  /** Drop the one-line credit from the caption. */
  | "noAttribution";

export type QuotaPeriod = "day" | "week" | "month" | "lifetime";

/** How a plan is paid for — drives the price display and the checkout path. */
export type Cadence = "free" | "month" | "once";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  cadence: Cadence;
  tagline: string;
  /** Carousels per `quotaPeriod`, on any engine. Infinity = uncapped. */
  quota: number;
  quotaPeriod: QuotaPeriod;
  /** Of those, how many may run on our embedded key. 0 = bring your own. */
  hostedQuota: number;
  hostedPeriod: QuotaPeriod;
  features: ReadonlySet<Feature>;
  perks: string[];
}

/**
 * The free weekly allowance. Two is deliberate: enough to make something real
 * and post it, not enough to run a posting schedule — which is exactly the
 * moment the licence is worth $9.
 */
export const FREE_WEEKLY_QUOTA = 2;

/**
 * Carousels a licence holder may run on our engine each month, so that a
 * creator without an API key still gets full value. At roughly a fifth of a
 * cent per deck on the hosted engine this is ~6¢ per buyer per month — cheap
 * insurance against excluding every non-technical customer.
 *
 * Set to 0 to make the licence strictly bring-your-own-key.
 */
export const MAKER_HOSTED_MONTHLY_QUOTA = 30;

/** Every feature, available to everyone. The cap is the only caveat. */
const EVERY_FEATURE: Feature[] = ["customize", "inspiration", "hostedResearch", "brandKit"];

/**
 * The caption credit stays on the free tiers. It is the distribution loop —
 * every free carousel posted tells its audience where it came from — and it
 * gives the licence a second, visible reason to exist. Flip this to include
 * "noAttribution" in the free feature list to make the free tier credit-free.
 */
const FREE_FEATURES: Feature[] = [...EVERY_FEATURE];
const MAKER_FEATURES: Feature[] = [...EVERY_FEATURE, "unlimited", "noAttribution"];

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "free",
    tagline: "Everything the tool can do, two carousels a week.",
    quota: FREE_WEEKLY_QUOTA,
    quotaPeriod: "week",
    hostedQuota: FREE_WEEKLY_QUOTA,
    hostedPeriod: "week",
    features: new Set(FREE_FEATURES),
    perks: [
      `${FREE_WEEKLY_QUOTA} carousels a week`,
      `Every feature: all ${PRESETS.length} templates, all voices, Art Director`,
      "Match a look, Brand Kit, research — all included",
      "Full-resolution 4:5 export, no watermark",
    ],
  },
  byok: {
    id: "byok",
    name: "Your own key",
    price: "$0",
    cadence: "free",
    tagline: "Your key writes the words. Same two a week until you're licensed.",
    quota: FREE_WEEKLY_QUOTA,
    quotaPeriod: "week",
    // Their key pays for the words, so they never draw on our engine.
    hostedQuota: 0,
    hostedPeriod: "week",
    features: new Set(FREE_FEATURES),
    perks: [
      `${FREE_WEEKLY_QUOTA} carousels a week`,
      "Claude-grade copy and live web research, on your key",
      "Every feature included",
      "No account needed — the key is your sign-in",
    ],
  },
  maker: {
    id: "maker",
    name: "Maker licence",
    price: "$9 once",
    cadence: "once",
    tagline: "For posting on a schedule. One payment, yours forever.",
    quota: Infinity,
    quotaPeriod: "lifetime",
    hostedQuota: MAKER_HOSTED_MONTHLY_QUOTA,
    hostedPeriod: "month",
    features: new Set(MAKER_FEATURES),
    perks: [
      "Unlimited carousels on your own API key",
      `${MAKER_HOSTED_MONTHLY_QUOTA} a month on ours — no key needed`,
      "No credit line in your captions",
      "One payment. No subscription, ever.",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "byok", "maker"];

export function getPlan(id: string | undefined): PlanDef {
  return PLANS[(id ?? "free") as PlanId] ?? PLANS.free;
}

/** Does this plan include a feature? */
export function can(plan: string | undefined, feature: Feature): boolean {
  return getPlan(plan).features.has(feature);
}

/** Licence allowance for a plan, per its quota period. */
export function quotaLimit(plan: string | undefined): number {
  return getPlan(plan).quota;
}

/** The window a plan's licence quota resets on. */
export function quotaPeriod(plan: string | undefined): QuotaPeriod {
  return getPlan(plan).quotaPeriod;
}

/** How many of this plan's carousels may run on our embedded key. */
export function hostedLimit(plan: string | undefined): number {
  return getPlan(plan).hostedQuota;
}

export function hostedPeriod(plan: string | undefined): QuotaPeriod {
  return getPlan(plan).hostedPeriod;
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  /** True when the cap is reached and the next run must wait or be licensed. */
  blocked: boolean;
  unlimited: boolean;
}

/** Pure quota math; the caller supplies the count used in the current period. */
export function quotaState(plan: string | undefined, usedInPeriod: number): QuotaState {
  return stateFor(quotaLimit(plan), usedInPeriod);
}

/** The same math for the hosted-engine allowance. */
export function hostedState(plan: string | undefined, usedInPeriod: number): QuotaState {
  return stateFor(hostedLimit(plan), usedInPeriod);
}

function stateFor(limit: number, usedInPeriod: number): QuotaState {
  const unlimited = !Number.isFinite(limit);
  const used = Math.max(0, Math.floor(usedInPeriod));
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return { used, limit, remaining, blocked: !unlimited && remaining <= 0, unlimited };
}

/** Human phrasing for a period, for sentences like "2 left this week". */
export function periodLabel(period: QuotaPeriod): string {
  switch (period) {
    case "day":
      return "today";
    case "week":
      return "this week";
    case "month":
      return "this month";
    case "lifetime":
      return "in total";
  }
}

/**
 * Why someone is seeing the licence sheet. Every line names what the $9 buys —
 * never a feature, because no feature is withheld.
 */
export function upsellFor(feature: Feature): string {
  switch (feature) {
    case "unlimited":
      return "You've used your free carousels for this week. The Maker licence lifts the cap for good — one payment, $9.";
    case "noAttribution":
      return "Free captions carry a one-line credit. The Maker licence drops it.";
    case "customize":
    case "inspiration":
    case "hostedResearch":
    case "brandKit":
      return "This is free, and always will be. The licence only lifts the weekly cap.";
  }
}
