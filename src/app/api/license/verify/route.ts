/**
 * Check a pasted licence key.
 *
 * Used by the "I already have a licence" flow, so someone who bought on their
 * phone can unlock their laptop. Throttled because an unthrottled verifier is
 * an oracle: without a limit you could grind signatures against it. The
 * signature compare itself is constant-time (see `verifyLicense`).
 */

import { ipFromHeaders, licenseSecretFromEnv, revokedFromEnv, verifyLicense, verifyMessage } from "@/lib/access";
import { throttle } from "@/lib/security/throttle";

export const runtime = "nodejs";

const MAX_BODY = 4_000;

export async function POST(req: Request) {
  const ip = ipFromHeaders(req.headers);
  if (!throttle(`licverify:${ip}`, 12, 60_000)) {
    return Response.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Request too large." }, { status: 413 });

  let token: string | undefined;
  try {
    token = (JSON.parse(raw) as { token?: string }).token;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = verifyLicense(token, {
    secret: licenseSecretFromEnv(),
    revoked: revokedFromEnv(),
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: verifyMessage(result.reason) }, { status: 400 });
  }
  return Response.json({
    ok: true,
    seat: result.license.seat,
    email: result.license.email,
    issuedAt: result.license.iat,
  });
}
