/**
 * Exchange a completed payment for a licence key.
 *
 * The buyer's browser lands back on `/unlock?transaction_id=…` and calls this.
 * The transaction id in that URL is a *claim*, not proof, so we verify it
 * server-to-server with Flutterwave before minting anything, and the ledger
 * makes a replayed id return the licence that already exists instead of a new
 * one.
 *
 * There is also a development unlock (`CAROUSEL_LICENSE_DEV_UNLOCK=1`) so the
 * whole paid experience can be exercised before Flutterwave keys exist. It is
 * refused outright in production unless explicitly switched on, and it is the
 * one thing in this file that must never be enabled by accident.
 */

import { ipFromHeaders } from "@/lib/access";
import { flutterwaveConfigFromEnv, verifyPayment } from "@/lib/billing/flutterwave";
import { currentPrice, deliverLicense, issueLicense } from "@/lib/billing/issue";
import { throttle } from "@/lib/security/throttle";

export const runtime = "nodejs";

const MAX_BODY = 2_000;

export async function POST(req: Request) {
  const ip = ipFromHeaders(req.headers);
  if (!throttle(`redeem:${ip}`, 12, 60_000)) {
    return Response.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Request too large." }, { status: 413 });

  let body: { transactionId?: string; email?: string; dev?: boolean };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const devUnlock = process.env.CAROUSEL_LICENSE_DEV_UNLOCK === "1";
  if (body.dev) {
    if (!devUnlock) {
      return Response.json({ error: "Development unlock is disabled." }, { status: 403 });
    }
    const email = body.email?.trim().toLowerCase() || "dev@localhost";
    const issued = issueLicense({ txId: `dev-${Date.now()}`, email, amountUsd: 0 });
    return issued.ok
      ? Response.json({ token: issued.token, seat: issued.seat, dev: true, emailed: false })
      : Response.json({ error: issued.error }, { status: 500 });
  }

  const transactionId = body.transactionId?.trim();
  if (!transactionId) {
    return Response.json({ error: "No payment reference was supplied." }, { status: 400 });
  }

  const cfg = flutterwaveConfigFromEnv();
  if (!cfg) {
    return Response.json({ error: "Payments aren't configured on this server." }, { status: 503 });
  }

  // Price the licence from the ledger, then require the payment to cover it.
  const price = currentPrice();
  const verified = await verifyPayment(cfg, transactionId, { minUsd: price.usd });
  if (!verified.ok || !verified.txId) {
    return Response.json({ error: verified.error ?? "That payment could not be verified." }, { status: 402 });
  }

  const email = verified.email?.trim().toLowerCase() || body.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "That payment has no email attached. Contact us and we'll issue your licence." }, { status: 422 });
  }

  const issued = issueLicense({
    txId: verified.txId,
    email,
    amountUsd: verified.amountUsd,
  });
  if (!issued.ok) return Response.json({ error: issued.error }, { status: 500 });

  // Best-effort delivery: the key is shown on screen regardless.
  const delivery = issued.reused ? { delivered: false } : await deliverLicense(email, issued.token, issued.seat);

  return Response.json({
    token: issued.token,
    seat: issued.seat,
    email,
    reused: issued.reused,
    emailed: delivery.delivered,
  });
}
