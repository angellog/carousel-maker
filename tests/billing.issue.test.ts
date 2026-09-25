import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryLedger, nextSeat, setLedger } from "@/lib/access/ledger";
import { priceCaption, priceFor, pricingConfigFromEnv } from "@/lib/access/pricing";
import { verifyLicense } from "@/lib/access/license";
import { deliverLicense, issueLicense } from "@/lib/billing/issue";

const SECRET = "issue-test-secret";
const ENV = { CAROUSEL_LICENSE_SECRET: SECRET } as Record<string, string | undefined>;

let ledger: MemoryLedger;
beforeEach(() => {
  ledger = new MemoryLedger();
  setLedger(ledger);
});

describe("issuing a licence", () => {
  it("mints a verifiable licence and records it", () => {
    const result = issueLicense({ txId: "flw-1", email: "Buyer@Example.com ", env: ENV, ledger });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.seat).toBe(1);
    expect(result.reused).toBe(false);
    const verified = verifyLicense(result.token, { secret: SECRET });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.license.email).toBe("buyer@example.com");
    expect(ledger.issued()).toBe(1);
  });

  it("is idempotent per payment — a retried webhook cannot burn a second seat", () => {
    const first = issueLicense({ txId: "flw-42", email: "a@b.com", env: ENV, ledger });
    const second = issueLicense({ txId: "flw-42", email: "a@b.com", env: ENV, ledger });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.seat).toBe(first.seat);
    expect(second.token).toBe(first.token);
    expect(ledger.issued()).toBe(1);
  });

  it("numbers seats in purchase order", () => {
    issueLicense({ txId: "a", email: "a@b.com", env: ENV, ledger });
    issueLicense({ txId: "b", email: "c@d.com", env: ENV, ledger });
    const third = issueLicense({ txId: "c", email: "e@f.com", env: ENV, ledger });
    expect(third.ok && third.seat).toBe(3);
    expect(nextSeat(ledger)).toBe(4);
  });

  it("refuses without a configured secret, rather than minting something unverifiable", () => {
    const result = issueLicense({ txId: "x", email: "a@b.com", env: {}, ledger });
    expect(result).toEqual({ ok: false, error: expect.stringContaining("CAROUSEL_LICENSE_SECRET") });
  });

  it("requires a real email — it's the only way to re-send a lost key", () => {
    expect(issueLicense({ txId: "x", email: "", env: ENV, ledger }).ok).toBe(false);
    expect(issueLicense({ txId: "x", email: "nope", env: ENV, ledger }).ok).toBe(false);
  });
});

describe("the founding ladder", () => {
  it("defaults to 1,000 founding licences at $9, then $19", () => {
    const cfg = pricingConfigFromEnv({});
    expect(cfg).toMatchObject({ foundingSeats: 1000, foundingUsd: 9, standardUsd: 19 });
  });

  it("prices from the ledger and steps up when the cohort sells out", () => {
    const cfg = pricingConfigFromEnv({ CAROUSEL_FOUNDING_SEATS: "3" });
    expect(priceFor(0, cfg)).toMatchObject({ cohort: "founding", usd: 9, seatsLeft: 3 });
    expect(priceFor(2, cfg)).toMatchObject({ cohort: "founding", usd: 9, seatsLeft: 1 });
    expect(priceFor(3, cfg)).toMatchObject({ cohort: "standard", usd: 19, seatsLeft: 0 });
  });

  it("is env-tunable without a deploy", () => {
    const cfg = pricingConfigFromEnv({
      CAROUSEL_FOUNDING_SEATS: "1000",
      CAROUSEL_FOUNDING_PRICE: "12",
      CAROUSEL_STANDARD_PRICE: "29",
    });
    expect(priceFor(10, cfg)).toMatchObject({ usd: 12, nextUsd: 29, seatsLeft: 990 });
  });

  it("states a true, checkable count", () => {
    const cfg = pricingConfigFromEnv({});
    expect(priceCaption(priceFor(312, cfg))).toBe(
      "312 of 1,000 founding licences claimed. Then $19.",
    );
    expect(priceCaption(priceFor(1000, cfg))).toMatch(/sold out/i);
  });

  it("switches to counting down once the cohort is nearly gone", () => {
    const cfg = pricingConfigFromEnv({});
    expect(priceCaption(priceFor(900, cfg))).toBe("Only 100 founding licences left at $9. Then $19.");
    expect(priceCaption(priceFor(999, cfg))).toBe("Only 1 founding licence left at $9. Then $19.");
  });

  it("prices the 1,001st buyer at $19, without a deploy", () => {
    const cfg = pricingConfigFromEnv({});
    expect(priceFor(1000, cfg)).toMatchObject({ cohort: "standard", usd: 19, seatsLeft: 0 });
  });
});

describe("delivering the key", () => {
  it("says so plainly when no email provider is configured", async () => {
    const result = await deliverLicense("a@b.com", "cm1.x.y", 3, {});
    expect(result).toEqual({ delivered: false, error: "No email provider configured." });
  });

  it("sends the key and the seat number through Resend", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await deliverLicense("a@b.com", "cm1.token", 7, { RESEND_API_KEY: "re_x" }, fetchMock);
    expect(result.delivered).toBe(true);
    const [, init] = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(body.subject).toContain("#7");
    expect(body.text).toContain("cm1.token");
  });

  it("never throws when the provider fails — the key is on screen anyway", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const result = await deliverLicense("a@b.com", "cm1.token", 1, { RESEND_API_KEY: "re_x" }, fetchMock);
    expect(result).toEqual({ delivered: false, error: "network down" });
  });
});
