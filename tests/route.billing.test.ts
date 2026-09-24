import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { POST as redeem } from "@/app/api/license/redeem/route";
import { POST as verifyRoute } from "@/app/api/license/verify/route";
import { GET as accessRoute } from "@/app/api/access/route";
import { MemoryLedger, setLedger } from "@/lib/access/ledger";
import { resetQuota } from "@/lib/access/quota";
import { signLicense } from "@/lib/access/license";
import { LICENSE_HEADER } from "@/lib/access/identity";
import { resetThrottle } from "@/lib/security/throttle";
import type { AccessState } from "@/lib/access/types";

const SECRET = "route-test-secret";

let ledger: MemoryLedger;

function post(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
    body: JSON.stringify(body),
  });
}

/** A Flutterwave that behaves: one successful $9 USD charge. */
function flwFetch(over: Record<string, unknown> = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.endsWith("/payments")) {
      return new Response(JSON.stringify({ status: "success", data: { link: "https://pay/x" } }), { status: 200 });
    }
    if (u.includes("/transactions/")) {
      return new Response(
        JSON.stringify({
          status: "success",
          data: {
            id: 5150,
            tx_ref: "cm-1",
            status: "successful",
            amount: 9,
            currency: "USD",
            customer: { email: "buyer@example.com" },
            ...over,
          },
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  ledger = new MemoryLedger();
  setLedger(ledger);
  resetQuota();
  resetThrottle();
  vi.stubEnv("CAROUSEL_LICENSE_SECRET", SECRET);
  vi.stubEnv("FLW_PUBLIC_KEY", "FLWPUBK_TEST");
  vi.stubEnv("FLW_SECRET_KEY", "FLWSECK_TEST");
  vi.stubEnv("FLW_SECRET_HASH", "hook-secret");
  vi.stubEnv("CAROUSEL_LICENSE_DEV_UNLOCK", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/billing/checkout", () => {
  it("prices the licence server-side and returns a payment link", async () => {
    vi.stubGlobal("fetch", flwFetch());
    const res = await checkout(post("http://localhost/api/billing/checkout", { email: "a@b.com" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { link: string; price: { usd: number } };
    expect(body.link).toBe("https://pay/x");
    expect(body.price.usd).toBe(9);
  });

  it("ignores any amount the client tries to send", async () => {
    const f = flwFetch();
    vi.stubGlobal("fetch", f);
    await checkout(post("http://localhost/api/billing/checkout", { email: "a@b.com", amount: 1, price: 0.5 }));
    const [, init] = (f as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(JSON.parse(String(init.body)).amount).toBe("9");
  });

  it("insists on an email, because that's where the key goes", async () => {
    const res = await checkout(post("http://localhost/api/billing/checkout", { email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("says checkout isn't live rather than erroring, when keys are absent", async () => {
    vi.stubEnv("FLW_SECRET_KEY", "");
    const res = await checkout(post("http://localhost/api/billing/checkout", { email: "a@b.com" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/isn't live/i);
  });

  it("throttles a hammering client", async () => {
    vi.stubGlobal("fetch", flwFetch());
    for (let i = 0; i < 10; i++) {
      await checkout(post("http://localhost/api/billing/checkout", { email: "a@b.com" }));
    }
    const res = await checkout(post("http://localhost/api/billing/checkout", { email: "a@b.com" }));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/license/redeem", () => {
  it("verifies the payment with Flutterwave before minting anything", async () => {
    const f = flwFetch();
    vi.stubGlobal("fetch", f);
    const res = await redeem(post("http://localhost/api/license/redeem", { transactionId: "5150" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; seat: number };
    expect(body.seat).toBe(1);
    expect(body.token.startsWith("cm1.")).toBe(true);
    expect(String((f as unknown as { mock: { calls: [string][] } }).mock.calls[0][0])).toContain("/transactions/5150/verify");
  });

  it("returns the same licence for a replayed transaction", async () => {
    vi.stubGlobal("fetch", flwFetch());
    const a = (await (await redeem(post("http://localhost/api/license/redeem", { transactionId: "5150" }))).json()) as { token: string };
    const b = (await (await redeem(post("http://localhost/api/license/redeem", { transactionId: "5150" }))).json()) as { token: string; reused: boolean };
    expect(b.token).toBe(a.token);
    expect(b.reused).toBe(true);
    expect(ledger.issued()).toBe(1);
  });

  it("refuses an unpaid or made-up transaction id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: "error", message: "No transaction" }), { status: 404 })),
    );
    const res = await redeem(post("http://localhost/api/license/redeem", { transactionId: "made-up" }));
    expect(res.status).toBe(402);
    expect(ledger.issued()).toBe(0);
  });

  it("refuses an underpayment", async () => {
    vi.stubGlobal("fetch", flwFetch({ amount: 1 }));
    const res = await redeem(post("http://localhost/api/license/redeem", { transactionId: "5150" }));
    expect(res.status).toBe(402);
    expect(ledger.issued()).toBe(0);
  });

  it("keeps the development unlock off unless it is explicitly switched on", async () => {
    const res = await redeem(post("http://localhost/api/license/redeem", { dev: true }));
    expect(res.status).toBe(403);
    expect(ledger.issued()).toBe(0);

    vi.stubEnv("CAROUSEL_LICENSE_DEV_UNLOCK", "1");
    const allowed = await redeem(post("http://localhost/api/license/redeem", { dev: true }));
    expect(allowed.status).toBe(200);
  });
});

describe("POST /api/license/verify", () => {
  it("accepts a real key and reports the seat", async () => {
    const { token } = signLicense({ email: "a@b.com", tier: "maker", seat: 5 }, SECRET);
    const res = await verifyRoute(post("http://localhost/api/license/verify", { token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, seat: 5, email: "a@b.com" });
  });

  it("rejects a forged key with a sentence, not a stack trace", async () => {
    const { token } = signLicense({ email: "a@b.com", tier: "maker", seat: 5 }, "a-different-secret");
    const res = await verifyRoute(post("http://localhost/api/license/verify", { token }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/isn't valid/i);
  });

  it("throttles, so it can't be used as a signature oracle", async () => {
    for (let i = 0; i < 12; i++) {
      await verifyRoute(post("http://localhost/api/license/verify", { token: `cm1.a.${i}` }));
    }
    const res = await verifyRoute(post("http://localhost/api/license/verify", { token: "cm1.a.b" }));
    expect(res.status).toBe(429);
  });
});

describe("POST /api/billing/webhook", () => {
  const event = {
    event: "charge.completed",
    data: { id: 5150, status: "successful", customer: { email: "buyer@example.com" } },
  };

  it("refuses an unsigned call — otherwise the URL is a licence printer", async () => {
    const res = await webhook(post("http://localhost/api/billing/webhook", event));
    expect(res.status).toBe(401);
    expect(ledger.issued()).toBe(0);
  });

  it("refuses a wrong signature", async () => {
    const res = await webhook(post("http://localhost/api/billing/webhook", event, { "verif-hash": "wrong" }));
    expect(res.status).toBe(401);
    expect(ledger.issued()).toBe(0);
  });

  it("mints on a signed, re-verified charge", async () => {
    vi.stubGlobal("fetch", flwFetch());
    const res = await webhook(post("http://localhost/api/billing/webhook", event, { "verif-hash": "hook-secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, seat: 1 });
    expect(ledger.issued()).toBe(1);
  });

  it("is idempotent across retries", async () => {
    vi.stubGlobal("fetch", flwFetch());
    await webhook(post("http://localhost/api/billing/webhook", event, { "verif-hash": "hook-secret" }));
    await webhook(post("http://localhost/api/billing/webhook", event, { "verif-hash": "hook-secret" }));
    expect(ledger.issued()).toBe(1);
  });

  it("acknowledges non-charge noise so Flutterwave stops retrying it", async () => {
    const res = await webhook(
      post("http://localhost/api/billing/webhook", { event: "transfer.completed", data: { id: 1, status: "pending" } }, { "verif-hash": "hook-secret" }),
    );
    expect(res.status).toBe(200);
    expect(ledger.issued()).toBe(0);
  });

  it("refuses everything when no webhook secret is configured", async () => {
    vi.stubEnv("FLW_SECRET_HASH", "");
    const res = await webhook(post("http://localhost/api/billing/webhook", event, { "verif-hash": "hook-secret" }));
    expect(res.status).toBe(503);
  });
});

describe("GET /api/access", () => {
  it("reports the free allowance for an anonymous visitor", async () => {
    const res = await accessRoute(new Request("http://localhost/api/access", { headers: { "x-forwarded-for": "198.51.100.7" } }));
    const state = (await res.json()) as AccessState;
    expect(state.plan).toBe("free");
    expect(state.quota).toMatchObject({ limit: 2, remaining: 2, period: "this week" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reports the licence when one is presented", async () => {
    const { token } = signLicense({ email: "a@b.com", tier: "maker", seat: 3 }, SECRET);
    const res = await accessRoute(
      new Request("http://localhost/api/access", { headers: { [LICENSE_HEADER]: token } }),
    );
    const state = (await res.json()) as AccessState;
    expect(state.plan).toBe("maker");
    expect(state.license?.seat).toBe(3);
  });
});
