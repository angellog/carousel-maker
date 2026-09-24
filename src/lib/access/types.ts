/**
 * The access vocabulary, as types only.
 *
 * This file exists so the browser can talk about plans, quotas and licences
 * without importing the modules that verify them — those reach for
 * `node:crypto` and the filesystem, which belong on the server and nowhere
 * near a client bundle. Types erase at compile time, so this import costs the
 * browser nothing.
 */

import type { PlanId, QuotaState } from "../plan";
import type { PriceTier } from "./pricing";

export type IdentityKind = "license" | "account" | "key" | "ip";

export type VerifyFailure =
  | "missing"
  | "malformed"
  | "bad-version"
  | "bad-signature"
  | "revoked"
  | "no-secret";

/** Why a request was refused: the licence cap, or our engine's allowance. */
export type DenyReason = "cap" | "hosted";

/** A quota, plus the words the UI needs to describe it. */
export interface QuotaView extends QuotaState {
  /** "this week", "this month" — reads straight into a sentence. */
  period: string;
  /** Seconds until the oldest use falls out of the window. */
  resetsInSeconds?: number;
}

/** Everything the UI needs to tell the truth about this visitor. */
export interface AccessState {
  plan: PlanId;
  planName: string;
  identity: { kind: IdentityKind; label: string };
  /** The licence cap — what the Maker licence lifts. */
  quota: QuotaView;
  /** The allowance on our embedded engine. */
  hosted: QuotaView;
  license?: { seat: number; email: string; issuedAt: number };
  licenseError?: VerifyFailure;
  price: PriceTier;
}
