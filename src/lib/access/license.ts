/**
 * The Maker licence — a signed token, not a database row.
 *
 * A one-time purchase has no renewal, no seat management and no account to
 * hang off, so the lightest correct design is an offline-verifiable token: the
 * server signs the licence once with a secret only it knows, the buyer keeps
 * the token, and every later request is verified with one HMAC. No database,
 * no session, nothing to migrate, and the token works on any device the buyer
 * pastes it into — which is what people expect from something they *bought*.
 *
 * Format:  cm1.<payload-base64url>.<hmac-sha256-base64url>
 *
 * The signature covers the exact payload bytes, so a buyer cannot edit their
 * own tier, their seat number or the issue date. Refunds and abuse are handled
 * by revoking an id (`CAROUSEL_LICENSE_REVOKED`), which is the one thing a
 * stateless token can't express on its own.
 */

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { VerifyFailure } from "./types";

export type { VerifyFailure };

export const LICENSE_VERSION = "cm1";

export interface License {
  /** Stable id — what gets revoked, and what the buyer quotes in support. */
  id: string;
  /** The buyer, for support and for re-issuing a lost licence. */
  email: string;
  /** Only one tier exists today; the field keeps the door open. */
  tier: "maker";
  /** Which numbered licence this is — the founding-cohort receipt. */
  seat: number;
  /** Issued-at, epoch milliseconds. */
  iat: number;
  /** The payment this licence was issued against (idempotency + audit). */
  txId?: string;
}

export type VerifyResult =
  | { ok: true; license: License }
  | { ok: false; reason: VerifyFailure };

const b64url = (buf: Buffer) => buf.toString("base64url");

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

/** Mint a licence token. The caller owns idempotency (see the ledger). */
export function signLicense(
  license: Omit<License, "id" | "iat"> & Partial<Pick<License, "id" | "iat">>,
  secret: string,
): { token: string; license: License } {
  if (!secret) throw new Error("A licence secret is required to sign a licence.");
  const full: License = {
    id: license.id ?? randomUUID(),
    email: license.email,
    tier: license.tier,
    seat: license.seat,
    iat: license.iat ?? Date.now(),
    ...(license.txId ? { txId: license.txId } : {}),
  };
  const payload = b64url(Buffer.from(JSON.stringify(full)));
  const sig = b64url(hmac(secret, payload));
  return { token: `${LICENSE_VERSION}.${payload}.${sig}`, license: full };
}

/**
 * Verify a token. Constant-time on the signature so the endpoint can't be used
 * as an oracle to hunt for a valid one byte at a time.
 */
export function verifyLicense(
  token: string | null | undefined,
  opts: { secret: string | undefined; revoked?: Iterable<string> },
): VerifyResult {
  if (!token) return { ok: false, reason: "missing" };
  if (!opts.secret) return { ok: false, reason: "no-secret" };

  const parts = token.trim().split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, payload, sig] = parts;
  if (version !== LICENSE_VERSION) return { ok: false, reason: "bad-version" };

  const expected = hmac(opts.secret, payload);
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return { ok: false, reason: "bad-signature" };
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad-signature" };
  }

  let license: License;
  try {
    license = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as License;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!license?.id || license.tier !== "maker") return { ok: false, reason: "malformed" };

  for (const id of opts.revoked ?? []) {
    if (id === license.id) return { ok: false, reason: "revoked" };
  }
  return { ok: true, license };
}

/** A sentence the UI can show when a licence won't verify. */
export function verifyMessage(reason: VerifyFailure): string {
  switch (reason) {
    case "missing":
      return "Paste your licence key to unlock.";
    case "malformed":
    case "bad-version":
      return "That doesn't look like a licence key. Copy the whole line from your receipt email.";
    case "bad-signature":
      return "That licence key isn't valid. Check for a missing character, or email us and we'll re-send it.";
    case "revoked":
      return "This licence has been revoked. If that's a surprise, reply to your receipt and we'll sort it out.";
    case "no-secret":
      return "Licences aren't configured on this server yet.";
  }
}

export function licenseSecretFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return env.CAROUSEL_LICENSE_SECRET?.trim() || undefined;
}

/** Revoked licence ids — a comma/space separated list, for refunds and abuse. */
export function revokedFromEnv(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return (env.CAROUSEL_LICENSE_REVOKED ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The short form shown in the UI: the last segment is enough to identify it. */
export function licenseLabel(license: License): string {
  return `#${license.seat} · ${license.id.slice(0, 8)}`;
}
