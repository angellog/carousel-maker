/**
 * Turning a verified payment into a licence — the one path that mints value.
 *
 * Shared by the webhook (the authority) and the redeem endpoint (what the
 * buyer's browser hits when it comes back from Flutterwave), because both can
 * legitimately be first: webhooks sometimes land seconds late, and a buyer
 * staring at a spinner shouldn't wait on one. Whoever gets there first mints
 * the licence; the other finds it in the ledger and returns the same token.
 * That's why the token is a deterministic function of the payment rather than
 * something random per call.
 */

import {
  entryFor,
  getLedger,
  licenseSecretFromEnv,
  nextSeat,
  priceFor,
  pricingConfigFromEnv,
  signLicense,
  type License,
  type LicenseLedger,
} from "../access";

export interface IssueInput {
  txId: string;
  email: string;
  amountUsd?: number;
  env?: Record<string, string | undefined>;
  ledger?: LicenseLedger;
  now?: number;
}

export type IssueResult =
  | { ok: true; token: string; license: License; reused: boolean; seat: number }
  | { ok: false; error: string };

/**
 * Mint (or re-mint) the licence for a payment. Idempotent by transaction id:
 * calling it twice with the same payment returns the same seat and the same
 * token, so a retried webhook can't burn a second founding seat.
 */
export function issueLicense(input: IssueInput): IssueResult {
  const env = input.env ?? process.env;
  const secret = licenseSecretFromEnv(env);
  if (!secret) {
    return { ok: false, error: "Licensing isn't configured on this server (no CAROUSEL_LICENSE_SECRET)." };
  }
  const email = input.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "A valid email is required." };

  const ledger = input.ledger ?? getLedger(env);
  const existing = ledger.findByTx(input.txId);
  if (existing) {
    const { token, license } = signLicense(
      {
        id: existing.id,
        email: existing.email,
        tier: "maker",
        seat: existing.seat,
        iat: existing.iat,
        txId: existing.txId,
      },
      secret,
    );
    return { ok: true, token, license, reused: true, seat: existing.seat };
  }

  const seat = nextSeat(ledger);
  const { token, license } = signLicense(
    { email, tier: "maker", seat, txId: input.txId, iat: input.now },
    secret,
  );
  ledger.record(entryFor(license, input.amountUsd));
  return { ok: true, token, license, reused: false, seat };
}

/** The price a new buyer should be charged right now. */
export function currentPrice(env: Record<string, string | undefined> = process.env) {
  return priceFor(getLedger(env).issued(), pricingConfigFromEnv(env));
}

export interface DeliveryResult {
  delivered: boolean;
  error?: string;
}

/**
 * Email the licence key. Resend when a key is configured, otherwise a no-op
 * that says so — the buyer always sees the key on screen as well, so email is
 * a convenience, never the only copy. (This is also why the receipt page tells
 * them to save it.)
 */
export async function deliverLicense(
  email: string,
  token: string,
  seat: number,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<DeliveryResult> {
  const key = env.RESEND_API_KEY?.trim();
  const from = env.LICENSE_FROM_EMAIL?.trim() || "licences@thecarouselmaker.com";
  if (!key) return { delivered: false, error: "No email provider configured." };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `The Carousel Maker <${from}>`,
        to: [email],
        subject: `Your Maker licence (#${seat})`,
        text: [
          `You're licence #${seat}. Thank you — genuinely.`,
          "",
          "Your licence key:",
          token,
          "",
          "Paste it into the app under Go unlimited → I have a licence. It works on every device you paste it into, and it never expires.",
          "",
          "Keep this email; it's the only copy of your key we send.",
        ].join("\n"),
      }),
    });
    if (!res.ok) return { delivered: false, error: `Email provider returned ${res.status}.` };
    return { delivered: true };
  } catch (err) {
    return { delivered: false, error: err instanceof Error ? err.message : "Email failed." };
  }
}
