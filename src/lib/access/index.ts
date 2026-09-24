/**
 * Access control — the one place that decides whether a carousel may be made.
 *
 * `/api/generate` asks `authorize()`; the browser asks `describe()` so the UI
 * can tell the truth about what's left. Both read the same counters, so the
 * number on screen is the number the server will enforce. Nothing here trusts
 * anything the client says about its plan.
 *
 * A slot is claimed *before* the work runs, so two tabs firing at once can't
 * both slip past the last remaining carousel; if the work then fails to start,
 * the caller rolls the slot back and nobody is charged for nothing.
 */

import {
  getPlan,
  hostedPeriod,
  hostedState,
  periodLabel,
  quotaPeriod,
  quotaState,
} from "../plan";
import { resolveIdentity, type Identity, type ResolveOptions } from "./identity";
import { licenseSecretFromEnv, revokedFromEnv } from "./license";
import type { AccessState, DenyReason } from "./types";
import { getLedger } from "./ledger";
import { priceFor, pricingConfigFromEnv } from "./pricing";
import { hitsInPeriod, recordUse, secondsUntilFree, usedInPeriod, type Meter } from "./quota";

export * from "./identity";
export * from "./license";
export * from "./ledger";
export * from "./pricing";
export * from "./quota";
export * from "./types";

export interface AuthorizeInput {
  headers: Headers;
  /** The bring-your-own key from the request body, when present. */
  apiKey?: string;
  /** True when this run will spend *our* money (embedded key). */
  serverPaid: boolean;
  now?: number;
  env?: Record<string, string | undefined>;
}

export type AuthorizeResult =
  | {
      ok: true;
      state: AccessState;
      identity: Identity;
      /** Undo the claimed slot when the work never ran. */
      rollback: () => void;
    }
  | {
      ok: false;
      state: AccessState;
      identity: Identity;
      reason: DenyReason;
      message: string;
      retryAfter?: number;
    };

function resolveOptions(env: Record<string, string | undefined>, apiKey?: string): ResolveOptions {
  return { secret: licenseSecretFromEnv(env), revoked: revokedFromEnv(env), apiKey };
}

/** Read-only view of where an identity stands. Consumes nothing. */
export async function describe(
  headers: Headers,
  opts: { apiKey?: string; now?: number; env?: Record<string, string | undefined> } = {},
): Promise<{ state: AccessState; identity: Identity }> {
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const identity = await resolveIdentity(headers, resolveOptions(env, opts.apiKey));
  return { state: stateFor(identity, now, env), identity };
}

function stateFor(
  identity: Identity,
  now: number,
  env: Record<string, string | undefined>,
): AccessState {
  const plan = getPlan(identity.plan);
  const licenceUsed = usedInPeriod(identity.id, "licence", plan.quotaPeriod, now);
  const hostedUsed = usedInPeriod(identity.id, "hosted", plan.hostedPeriod, now);

  const quota = quotaState(plan.id, licenceUsed);
  const hosted = hostedState(plan.id, hostedUsed);

  return {
    plan: plan.id,
    planName: plan.name,
    identity: { kind: identity.kind, label: identity.label },
    quota: {
      ...quota,
      period: periodLabel(quotaPeriod(plan.id)),
      resetsInSeconds: quota.blocked
        ? secondsUntilFree(hitsInPeriod(identity.id, "licence", plan.quotaPeriod, now), plan.quotaPeriod, now)
        : undefined,
    },
    hosted: {
      ...hosted,
      period: periodLabel(hostedPeriod(plan.id)),
      resetsInSeconds: hosted.blocked
        ? secondsUntilFree(hitsInPeriod(identity.id, "hosted", plan.hostedPeriod, now), plan.hostedPeriod, now)
        : undefined,
    },
    ...(identity.license
      ? {
          license: {
            seat: identity.license.seat,
            email: identity.license.email,
            issuedAt: identity.license.iat,
          },
        }
      : {}),
    ...(identity.licenseError ? { licenseError: identity.licenseError } : {}),
    price: priceFor(getLedger(env).issued(), pricingConfigFromEnv(env)),
  };
}

/** Claim a slot, or explain why not. */
export async function authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
  const env = input.env ?? process.env;
  const now = input.now ?? Date.now();
  const identity = await resolveIdentity(input.headers, resolveOptions(env, input.apiKey));
  const state = stateFor(identity, now, env);
  const plan = getPlan(identity.plan);

  if (state.quota.blocked) {
    return {
      ok: false,
      state,
      identity,
      reason: "cap",
      message: capMessage(identity, state),
      retryAfter: state.quota.resetsInSeconds,
    };
  }

  if (input.serverPaid && state.hosted.blocked) {
    return {
      ok: false,
      state,
      identity,
      reason: "hosted",
      message: hostedMessage(identity, state),
      retryAfter: state.hosted.resetsInSeconds,
    };
  }

  // Claim the slot(s) now so two tabs can't both take the last free carousel.
  // An unlimited plan has no licence counter to keep — only the hosted
  // allowance, which is the part that costs us money.
  const meters: Meter[] = [];
  if (!plan.features.has("unlimited")) meters.push("licence");
  if (input.serverPaid) meters.push("hosted");
  const rollback = recordUse(identity.id, meters, now);

  return { ok: true, state, identity, rollback };
}

function capMessage(identity: Identity, state: AccessState): string {
  const wait = state.quota.resetsInSeconds ? ` It frees up in ${humanDuration(state.quota.resetsInSeconds)}.` : "";
  if (identity.kind === "ip") {
    return `That's your ${state.quota.limit} free carousels ${state.quota.period} from this network.${wait} The Maker licence (${state.price.display}, once) lifts the cap for good.`;
  }
  return `That's your ${state.quota.limit} free carousels ${state.quota.period}.${wait} The Maker licence (${state.price.display}, once) lifts the cap for good.`;
}

function hostedMessage(identity: Identity, state: AccessState): string {
  if (identity.kind === "license") {
    const wait = state.hosted.resetsInSeconds ? ` More free up in ${humanDuration(state.hosted.resetsInSeconds)}.` : "";
    return `You've used your ${state.hosted.limit} carousels on our engine ${state.hosted.period}.${wait} Add your own API key under Options → API key for unlimited right now — that's what the licence is for.`;
  }
  return `The free engine is used up ${state.hosted.period}. Add your own API key under Options → API key to keep going now.`;
}

/** "3 days", "6 hours", "12 minutes" — enough precision to be useful. */
export function humanDuration(seconds: number): string {
  const units: [number, string][] = [
    [86_400, "day"],
    [3_600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const n = Math.round(seconds / size);
      return `${n} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  return "a moment";
}
