/**
 * Who is asking, and on what plan.
 *
 * Four identities, in order of how much we trust them:
 *
 *   1. **Licence** — a signed token. Cryptographic, device-portable, the only
 *      identity that can lift the cap.
 *   2. **Account** — a signed-in user. Not wired yet (Supabase is a pending
 *      cost decision, see docs/launch-readiness.md), so this is an injectable
 *      resolver: when accounts land, one adapter plugs in here and every quota
 *      in the app becomes per-account without touching a route.
 *   3. **Key** — the hash of a bring-your-own API key. Honest but soft: a key
 *      is a secret, not an account, and someone can mint a new one. We use it
 *      because it's friendlier than an IP for the people who have one, not
 *      because it's unforgeable.
 *   4. **IP** — the floor. Shared offices, campuses and mobile carriers behind
 *      CGNAT all look like one visitor, so this is a spend guard, never a
 *      fairness mechanism.
 *
 * Nothing here trusts the client's own claim about its plan: the plan is
 * *derived* from the strongest identity that verifies.
 */

import { createHash } from "node:crypto";
import type { PlanId } from "../plan";
import { verifyLicense, type License } from "./license";
import type { IdentityKind, VerifyFailure } from "./types";

export type { IdentityKind };

/** Header the browser sends its licence token in. */
export const LICENSE_HEADER = "x-cm-license";

export interface Identity {
  kind: IdentityKind;
  /** Namespaced so two kinds can never collide in the quota store. */
  id: string;
  plan: PlanId;
  license?: License;
  /** Set when a licence token was supplied but did not verify. */
  licenseError?: VerifyFailure;
  /** A short, safe label for logs and the UI. */
  label: string;
}

/** Resolves a signed-in user from a request. Returns undefined when absent. */
export type AccountResolver = (
  headers: Headers,
) => Promise<{ id: string; plan?: PlanId } | undefined> | { id: string; plan?: PlanId } | undefined;

let accountResolver: AccountResolver | undefined;

/** Wire accounts in (Supabase et al) without touching any route. */
export function setAccountResolver(resolver: AccountResolver | undefined): void {
  accountResolver = resolver;
}

/** Stable, non-reversible id for a bring-your-own key. Never log the key. */
export function keyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey.trim()).digest("hex").slice(0, 16);
}

/**
 * Best-effort caller IP. Prefers standard proxy headers so it works behind
 * Railway/Vercel/nginx; falls back to one shared bucket, which just means
 * stricter shared limits for callers we can't tell apart.
 */
export function ipFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "anonymous";
}

export interface ResolveOptions {
  secret: string | undefined;
  revoked?: Iterable<string>;
  /** The bring-your-own key from the request body, if any. Hashed, never kept. */
  apiKey?: string;
}

export async function resolveIdentity(headers: Headers, opts: ResolveOptions): Promise<Identity> {
  // 1. Licence.
  const token = headers.get(LICENSE_HEADER);
  if (token) {
    const result = verifyLicense(token, { secret: opts.secret, revoked: opts.revoked });
    if (result.ok) {
      return {
        kind: "license",
        id: `lic:${result.license.id}`,
        plan: "maker",
        license: result.license,
        label: `licence #${result.license.seat}`,
      };
    }
    // A bad licence must not silently pass as anonymous-free: fall through to
    // a lesser identity, but carry the reason so the UI can explain itself.
    const fallback = await lesserIdentity(headers, opts);
    return { ...fallback, licenseError: result.reason };
  }
  return lesserIdentity(headers, opts);
}

async function lesserIdentity(headers: Headers, opts: ResolveOptions): Promise<Identity> {
  // 2. Account (when a resolver is installed).
  if (accountResolver) {
    const account = await accountResolver(headers);
    if (account?.id) {
      return {
        kind: "account",
        id: `user:${account.id}`,
        plan: account.plan ?? "free",
        label: "signed in",
      };
    }
  }

  // 3. Bring-your-own key.
  const key = opts.apiKey?.trim();
  if (key) {
    const fp = keyFingerprint(key);
    return { kind: "key", id: `key:${fp}`, plan: "byok", label: `key ${fp.slice(0, 6)}` };
  }

  // 4. IP floor.
  const ip = ipFromHeaders(headers);
  return { kind: "ip", id: `ip:${ip}`, plan: "free", label: "this network" };
}
