/**
 * Cloudflare Turnstile verification — the bot shield in front of the paid path.
 *
 * When we embed our own key on a public URL, a script hitting /api/generate in a
 * loop spends real money. The rate limiter caps the bleed; Turnstile stops the
 * bot from getting a slot in the first place. It gates ONLY the server-paid path
 * (our embedded key). Bring-your-own-key and the keyless template writer are
 * never challenged.
 *
 * Fail-open by configuration, not by accident: when no secret is set (local dev,
 * or a self-host that opts out) verification is skipped so nothing breaks. It
 * only activates once TURNSTILE_SECRET is present.
 */

export interface TurnstileResult {
  ok: boolean;
  /** Why it failed / was skipped, for logging. Never shown to the user raw. */
  reason?: string;
}

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSecretFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  const s = env.TURNSTILE_SECRET;
  return s && s.trim() ? s.trim() : undefined;
}

/**
 * Verify a Turnstile token with Cloudflare. Returns ok:true (reason "disabled")
 * when no secret is configured, so callers can always await this unconditionally.
 */
export async function verifyTurnstile(
  token: string | undefined | null,
  secret: string | undefined,
  remoteip?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!secret) return { ok: true, reason: "disabled" };
  if (!token) return { ok: false, reason: "missing-token" };
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteip && remoteip !== "anonymous") body.set("remoteip", remoteip);
    const res = await fetchImpl(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success) return { ok: true };
    return { ok: false, reason: (data["error-codes"] ?? []).join(",") || "failed" };
  } catch {
    // A verification outage should not hand attackers a free pass; treat an
    // unreachable verifier as a soft failure the client can retry.
    return { ok: false, reason: "verify-unreachable" };
  }
}
