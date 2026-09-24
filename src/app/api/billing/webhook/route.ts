/**
 * Flutterwave webhook — the authority on payments.
 *
 * Three defences, in order:
 *   1. **Shared secret** — the `verif-hash` header must match `FLW_SECRET_HASH`,
 *      compared without early exit. No secret configured means no webhook is
 *      accepted at all; a webhook that trusts anonymous POSTs is a licence
 *      printer for anyone who finds the URL.
 *   2. **Re-verification** — we ignore the amounts in the payload and ask
 *      Flutterwave directly what that transaction was.
 *   3. **Idempotency** — the ledger keys on transaction id, so retries (which
 *      Flutterwave does, by design) can't mint a second licence or consume a
 *      second founding seat.
 */

import { flutterwaveConfigFromEnv, verifyPayment, webhookSignatureValid } from "@/lib/billing/flutterwave";
import { currentPrice, deliverLicense, issueLicense } from "@/lib/billing/issue";

export const runtime = "nodejs";

const MAX_BODY = 64_000;

export async function POST(req: Request) {
  const cfg = flutterwaveConfigFromEnv();
  if (!cfg?.secretHash) {
    return Response.json({ error: "Webhooks are not configured." }, { status: 503 });
  }
  if (!webhookSignatureValid(req.headers.get("verif-hash"), cfg.secretHash)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Request too large." }, { status: 413 });

  let event: { event?: string; data?: { id?: number | string; status?: string; customer?: { email?: string } } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Only completed charges mint licences; everything else is acknowledged so
  // Flutterwave stops retrying it.
  const isCharge = (event.event ?? "").startsWith("charge.") || !!event.data?.id;
  if (!isCharge || event.data?.status !== "successful") {
    return Response.json({ ok: true, ignored: true });
  }

  const transactionId = String(event.data?.id ?? "");
  if (!transactionId) return Response.json({ ok: true, ignored: true });

  const price = currentPrice();
  const verified = await verifyPayment(cfg, transactionId, { minUsd: price.usd });
  if (!verified.ok || !verified.txId) {
    // 200 with a reason: retrying won't change a payment that didn't qualify,
    // and a 5xx here would have Flutterwave hammer us for days.
    return Response.json({ ok: true, ignored: true, reason: verified.error });
  }

  const email = verified.email ?? event.data?.customer?.email;
  if (!email) return Response.json({ ok: true, ignored: true, reason: "no email on transaction" });

  const issued = issueLicense({ txId: verified.txId, email, amountUsd: verified.amountUsd });
  if (!issued.ok) {
    // A configuration failure *is* worth retrying — the payment is real.
    return Response.json({ error: issued.error }, { status: 500 });
  }

  if (!issued.reused) await deliverLicense(email, issued.token, issued.seat);
  return Response.json({ ok: true, seat: issued.seat, reused: issued.reused });
}
