/**
 * Flutterwave, in the smallest shape a one-time $9 sale needs.
 *
 * Two calls: start a payment, and verify one. Everything else (plans,
 * subscriptions, customers) belongs to a recurring product we deliberately
 * don't have. The rule that matters: **a redirect is not a payment.** The
 * browser coming back with `status=successful` proves nothing — anyone can
 * type that URL — so a licence is only ever minted after `verify()` is called
 * server-to-server with our secret key and the amount and currency check out.
 */

export interface FlutterwaveConfig {
  publicKey: string;
  secretKey: string;
  /** Shared secret set in the Flutterwave dashboard, sent as `verif-hash`. */
  secretHash?: string;
  baseUrl: string;
}

export function flutterwaveConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): FlutterwaveConfig | undefined {
  const publicKey = env.FLW_PUBLIC_KEY?.trim();
  const secretKey = env.FLW_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) return undefined;
  return {
    publicKey,
    secretKey,
    secretHash: env.FLW_SECRET_HASH?.trim() || undefined,
    baseUrl: env.FLW_BASE_URL?.trim() || "https://api.flutterwave.com/v3",
  };
}

export interface StartPaymentInput {
  txRef: string;
  amountUsd: number;
  email: string;
  redirectUrl: string;
  /** Free-form data echoed back on the transaction. */
  meta?: Record<string, string | number>;
}

export interface StartPaymentResult {
  ok: boolean;
  /** The hosted payment page to send the buyer to. */
  link?: string;
  error?: string;
}

export async function startPayment(
  cfg: FlutterwaveConfig,
  input: StartPaymentInput,
  fetchImpl: typeof fetch = fetch,
): Promise<StartPaymentResult> {
  try {
    const res = await fetchImpl(`${cfg.baseUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: String(input.amountUsd),
        currency: "USD",
        redirect_url: input.redirectUrl,
        customer: { email: input.email },
        customizations: {
          title: "The Carousel Maker",
          description: "Maker licence — one payment, yours forever",
        },
        meta: input.meta ?? {},
      }),
    });
    const body = (await res.json()) as { status?: string; message?: string; data?: { link?: string } };
    if (!res.ok || body.status !== "success" || !body.data?.link) {
      return { ok: false, error: body.message || `Payment could not be started (${res.status}).` };
    }
    return { ok: true, link: body.data.link };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Payment could not be started." };
  }
}

export interface VerifiedPayment {
  ok: boolean;
  txId?: string;
  txRef?: string;
  email?: string;
  amountUsd?: number;
  error?: string;
}

/**
 * Server-to-server verification. Succeeds only when Flutterwave says the
 * charge completed **and** the amount covers the price in USD — the classic
 * hole is trusting the callback's own numbers, which the buyer controls.
 */
export async function verifyPayment(
  cfg: FlutterwaveConfig,
  transactionId: string,
  expect: { minUsd: number },
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedPayment> {
  try {
    const res = await fetchImpl(
      `${cfg.baseUrl}/transactions/${encodeURIComponent(transactionId)}/verify`,
      { headers: { Authorization: `Bearer ${cfg.secretKey}` } },
    );
    const body = (await res.json()) as {
      status?: string;
      message?: string;
      data?: {
        id?: number | string;
        tx_ref?: string;
        status?: string;
        amount?: number;
        currency?: string;
        customer?: { email?: string };
      };
    };
    const data = body.data;
    if (!res.ok || body.status !== "success" || !data) {
      return { ok: false, error: body.message || `Could not verify that payment (${res.status}).` };
    }
    if (data.status !== "successful") {
      return { ok: false, error: `That payment is ${data.status ?? "not complete"}.` };
    }
    if ((data.currency ?? "").toUpperCase() !== "USD") {
      return { ok: false, error: "That payment wasn't in USD." };
    }
    if (typeof data.amount !== "number" || data.amount + 0.001 < expect.minUsd) {
      return { ok: false, error: "That payment doesn't cover the licence price." };
    }
    return {
      ok: true,
      txId: String(data.id ?? transactionId),
      txRef: data.tx_ref,
      email: data.customer?.email,
      amountUsd: data.amount,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not verify that payment." };
  }
}

/** Constant-time-ish compare for the webhook's shared secret. */
export function webhookSignatureValid(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!header) return false;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
