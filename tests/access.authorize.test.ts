import { beforeEach, describe, expect, it } from "vitest";
import { authorize, describe as describeAccess } from "@/lib/access";
import { LICENSE_HEADER, keyFingerprint } from "@/lib/access/identity";
import { signLicense } from "@/lib/access/license";
import { MemoryLedger, setLedger } from "@/lib/access/ledger";
import { resetQuota } from "@/lib/access/quota";
import { setAccountResolver } from "@/lib/access/identity";

const SECRET = "authorize-test-secret";
const ENV = { CAROUSEL_LICENSE_SECRET: SECRET } as Record<string, string | undefined>;
const DAY = 86_400_000;

function headers(h: Record<string, string> = {}): Headers {
  return new Headers({ "x-forwarded-for": "203.0.113.5", ...h });
}

async function run(opts: {
  headers?: Headers;
  apiKey?: string;
  serverPaid?: boolean;
  now?: number;
}) {
  return authorize({
    headers: opts.headers ?? headers(),
    apiKey: opts.apiKey,
    serverPaid: opts.serverPaid ?? true,
    now: opts.now,
    env: ENV,
  });
}

beforeEach(() => {
  resetQuota();
  setLedger(new MemoryLedger());
  setAccountResolver(undefined);
});

describe("authorize — the free weekly cap", () => {
  it("allows two and refuses the third from the same network", async () => {
    expect((await run({})).ok).toBe(true);
    expect((await run({})).ok).toBe(true);
    const third = await run({});
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.reason).toBe("cap");
      expect(third.message).toMatch(/2 free carousels this week/i);
      expect(third.message).toMatch(/licence/i);
    }
  });

  it("rolls the window forward: the slot frees up seven days later", async () => {
    const t0 = Date.UTC(2026, 0, 1);
    await run({ now: t0 });
    await run({ now: t0 + 60_000 });
    expect((await run({ now: t0 + 2 * DAY })).ok).toBe(false);
    // Seven days after the first use, that first slot falls out of the window.
    expect((await run({ now: t0 + 7 * DAY + 1000 })).ok).toBe(true);
  });

  it("tells a blocked visitor when it frees up", async () => {
    const t0 = Date.UTC(2026, 0, 1);
    await run({ now: t0 });
    await run({ now: t0 });
    const blocked = await run({ now: t0 + DAY });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfter).toBeGreaterThan(0);
      expect(blocked.message).toMatch(/6 days/);
    }
  });

  it("counts networks separately", async () => {
    const a = headers({ "x-forwarded-for": "198.51.100.1" });
    const b = headers({ "x-forwarded-for": "198.51.100.2" });
    await run({ headers: a });
    await run({ headers: a });
    expect((await run({ headers: a })).ok).toBe(false);
    expect((await run({ headers: b })).ok).toBe(true);
  });

  it("gives the slot back when the work never ran", async () => {
    const first = await run({});
    expect(first.ok).toBe(true);
    if (first.ok) first.rollback();
    // The rolled-back run didn't count, so two remain.
    expect((await run({})).ok).toBe(true);
    expect((await run({})).ok).toBe(true);
    expect((await run({})).ok).toBe(false);
  });
});

describe("authorize — bring your own key", () => {
  it("identifies by key, not by network, and still caps at two", async () => {
    const key = "sk-ant-aaaabbbbccccdddd";
    expect((await run({ apiKey: key, serverPaid: false })).ok).toBe(true);
    expect((await run({ apiKey: key, serverPaid: false })).ok).toBe(true);
    const third = await run({ apiKey: key, serverPaid: false });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.identity.id).toBe(`key:${keyFingerprint(key)}`);

    // A different key is a different identity, from the same network.
    expect((await run({ apiKey: "sk-ant-zzzzyyyyxxxxwwww", serverPaid: false })).ok).toBe(true);
  });

  it("never draws on the hosted allowance", async () => {
    const { state } = await describeAccess(headers(), { apiKey: "sk-ant-key", env: ENV });
    expect(state.plan).toBe("byok");
    expect(state.hosted.limit).toBe(0);
  });
});

describe("authorize — a licence", () => {
  const { token, license } = signLicense({ email: "buyer@example.com", tier: "maker", seat: 12 }, SECRET);

  it("lifts the cap entirely", async () => {
    const h = headers({ [LICENSE_HEADER]: token });
    for (let i = 0; i < 25; i++) {
      const r = await run({ headers: h, serverPaid: false });
      expect(r.ok, `run ${i}`).toBe(true);
    }
  });

  it("still meters the hosted allowance, and says what to do about it", async () => {
    const h = headers({ [LICENSE_HEADER]: token });
    for (let i = 0; i < 30; i++) expect((await run({ headers: h, serverPaid: true })).ok).toBe(true);

    const blocked = await run({ headers: h, serverPaid: true });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe("hosted");
      expect(blocked.message).toMatch(/own API key/i);
    }
    // …but with their own key they are never blocked.
    expect((await run({ headers: h, serverPaid: false })).ok).toBe(true);
  });

  it("reports the licence in the state, for the UI", async () => {
    const { state } = await describeAccess(headers({ [LICENSE_HEADER]: token }), { env: ENV });
    expect(state.plan).toBe("maker");
    expect(state.license).toMatchObject({ seat: 12, email: "buyer@example.com" });
    expect(state.quota.unlimited).toBe(true);
    expect(license.tier).toBe("maker");
  });

  it("falls back to the free tier — with a reason — when the token is bad", async () => {
    const { state } = await describeAccess(headers({ [LICENSE_HEADER]: "cm1.fake.fake" }), { env: ENV });
    expect(state.plan).toBe("free");
    expect(state.licenseError).toBe("bad-signature");
  });

  it("refuses a revoked licence without crashing the request", async () => {
    const { state } = await describeAccess(headers({ [LICENSE_HEADER]: token }), {
      env: { ...ENV, CAROUSEL_LICENSE_REVOKED: license.id },
    });
    expect(state.plan).toBe("free");
    expect(state.licenseError).toBe("revoked");
  });
});

describe("authorize — accounts, when they land", () => {
  it("uses an injected account resolver ahead of the IP floor", async () => {
    setAccountResolver(() => ({ id: "user-123" }));
    const r = await run({});
    expect(r.ok).toBe(true);
    expect(r.identity.id).toBe("user:user-123");
    expect(r.identity.kind).toBe("account");
  });

  it("lets the resolver grant a plan (e.g. a subscription row)", async () => {
    setAccountResolver(() => ({ id: "user-9", plan: "maker" }));
    const { state } = await describeAccess(headers(), { env: ENV });
    expect(state.plan).toBe("maker");
    expect(state.quota.unlimited).toBe(true);
  });
});

describe("describe — read-only", () => {
  it("consumes nothing", async () => {
    await describeAccess(headers(), { env: ENV });
    await describeAccess(headers(), { env: ENV });
    const { state } = await describeAccess(headers(), { env: ENV });
    expect(state.quota.used).toBe(0);
    expect(state.quota.remaining).toBe(2);
  });

  it("carries the live price, so the UI never shows a stale one", async () => {
    const { state } = await describeAccess(headers(), { env: ENV });
    expect(state.price.usd).toBe(9);
    expect(state.price.cohort).toBe("founding");
  });
});
