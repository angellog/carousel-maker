import { describe, expect, it, vi } from "vitest";
import {
  flutterwaveConfigFromEnv,
  startPayment,
  verifyPayment,
  webhookSignatureValid,
} from "@/lib/billing/flutterwave";

const CFG = {
  publicKey: "FLWPUBK_TEST",
  secretKey: "FLWSECK_TEST",
  secretHash: "hash-abc",
  baseUrl: "https://api.flutterwave.com/v3",
};

function jsonFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("config", () => {
  it("is undefined until both keys exist, so checkout can fail loudly", () => {
    expect(flutterwaveConfigFromEnv({})).toBeUndefined();
    expect(flutterwaveConfigFromEnv({ FLW_PUBLIC_KEY: "a" })).toBeUndefined();
    expect(flutterwaveConfigFromEnv({ FLW_PUBLIC_KEY: "a", FLW_SECRET_KEY: "b" })).toMatchObject({
      publicKey: "a",
      secretKey: "b",
      baseUrl: "https://api.flutterwave.com/v3",
    });
  });
});

describe("starting a payment", () => {
  it("charges the price we set, in USD, and returns the hosted link", async () => {
    const f = jsonFetch(200, { status: "success", data: { link: "https://checkout.flutterwave.com/x" } });
    const result = await startPayment(
      CFG,
      { txRef: "cm-1", amountUsd: 9, email: "a@b.com", redirectUrl: "https://app/unlock" },
      f,
    );
    expect(result).toEqual({ ok: true, link: "https://checkout.flutterwave.com/x" });

    const [url, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.flutterwave.com/v3/payments");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer FLWSECK_TEST");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ amount: "9", currency: "USD", redirect_url: "https://app/unlock" });
    expect(body.customer.email).toBe("a@b.com");
  });

  it("reports a failure instead of pretending it worked", async () => {
    const f = jsonFetch(400, { status: "error", message: "Invalid currency" });
    const result = await startPayment(CFG, { txRef: "x", amountUsd: 9, email: "a@b.com", redirectUrl: "u" }, f);
    expect(result).toEqual({ ok: false, error: "Invalid currency" });
  });

  it("survives a network error", async () => {
    const f = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await startPayment(CFG, { txRef: "x", amountUsd: 9, email: "a@b.com", redirectUrl: "u" }, f)).toEqual({
      ok: false,
      error: "offline",
    });
  });
});

describe("verifying a payment — the money check", () => {
  const good = {
    status: "success",
    data: {
      id: 9911,
      tx_ref: "cm-1",
      status: "successful",
      amount: 9,
      currency: "USD",
      customer: { email: "buyer@example.com" },
    },
  };

  it("accepts a completed USD charge that covers the price", async () => {
    const result = await verifyPayment(CFG, "9911", { minUsd: 9 }, jsonFetch(200, good));
    expect(result).toMatchObject({ ok: true, txId: "9911", email: "buyer@example.com", amountUsd: 9 });
  });

  it("rejects an underpayment — the classic way a $9 product gets bought for $1", async () => {
    const underpaid = { ...good, data: { ...good.data, amount: 1 } };
    const result = await verifyPayment(CFG, "9911", { minUsd: 9 }, jsonFetch(200, underpaid));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/doesn't cover/i);
  });

  it("rejects another currency, where 9 units is not $9", async () => {
    const ngn = { ...good, data: { ...good.data, currency: "NGN", amount: 9000 } };
    expect((await verifyPayment(CFG, "9911", { minUsd: 9 }, jsonFetch(200, ngn))).ok).toBe(false);
  });

  it("rejects a pending or failed charge", async () => {
    const pending = { ...good, data: { ...good.data, status: "pending" } };
    const result = await verifyPayment(CFG, "9911", { minUsd: 9 }, jsonFetch(200, pending));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pending/);
  });

  it("rejects an unknown transaction", async () => {
    const result = await verifyPayment(CFG, "nope", { minUsd: 9 }, jsonFetch(404, { status: "error", message: "No transaction" }));
    expect(result).toEqual({ ok: false, error: "No transaction" });
  });
});

describe("webhook signature", () => {
  it("accepts only an exact match", () => {
    expect(webhookSignatureValid("hash-abc", "hash-abc")).toBe(true);
    expect(webhookSignatureValid("hash-abd", "hash-abc")).toBe(false);
    expect(webhookSignatureValid("hash-abc ", "hash-abc")).toBe(false);
  });

  it("refuses when either side is missing — never fails open", () => {
    expect(webhookSignatureValid(null, "hash")).toBe(false);
    expect(webhookSignatureValid("hash", undefined)).toBe(false);
    expect(webhookSignatureValid(null, undefined)).toBe(false);
  });
});
