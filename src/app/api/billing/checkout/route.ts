/**
 * Start a licence purchase.
 *
 * Takes an email (which is also how we can re-send a lost key, and the only
 * list a one-time product ever gets to build), prices the licence from the
 * live ledger — not from anything the client sends — and hands back a
 * Flutterwave payment link. The price is decided here on purpose: a client
 * that could name its own amount would be a $0.01 licence factory.
 */

import { randomUUID } from "node:crypto";
import { currentPrice } from "@/lib/billing/issue";
import { flutterwaveConfigFromEnv, startPayment } from "@/lib/billing/flutterwave";
import { ipFromHeaders } from "@/lib/access";
import { throttle } from "@/lib/security/throttle";

export const runtime = "nodejs";

const MAX_BODY = 2_000;

export async function POST(req: Request) {
  const ip = ipFromHeaders(req.headers);
  if (!throttle(`checkout:${ip}`, 10, 60_000)) {
    return Response.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return Response.json({ error: "Request too large." }, { status: 413 });
  }

  let email: string | undefined;
  try {
    email = (JSON.parse(raw) as { email?: string }).email?.trim().toLowerCase();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!email || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email — it's where your licence key goes." }, { status: 400 });
  }

  const cfg = flutterwaveConfigFromEnv();
  if (!cfg) {
    return Response.json(
      { error: "Checkout isn't live yet. Email us and we'll sort you out directly." },
      { status: 503 },
    );
  }

  const price = currentPrice();
  const txRef = `cm-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const origin = originFrom(req);

  const result = await startPayment(cfg, {
    txRef,
    amountUsd: price.usd,
    email,
    redirectUrl: `${origin}/unlock`,
    meta: { product: "maker-licence", seat: price.issued + 1 },
  });

  if (!result.ok || !result.link) {
    return Response.json({ error: result.error ?? "Payment could not be started." }, { status: 502 });
  }
  return Response.json({ link: result.link, txRef, price });
}

/** Prefer the configured public URL; fall back to the request's own origin. */
function originFrom(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* fall through */
    }
  }
  return new URL(req.url).origin;
}
