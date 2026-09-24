import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { LICENSE_HEADER } from "@/lib/access/identity";
import { signLicense } from "@/lib/access/license";
import { MemoryLedger, setLedger } from "@/lib/access/ledger";
import { resetQuota } from "@/lib/access/quota";
import { resetRateLimit } from "@/lib/providers/ratelimit";
import type { AccessState } from "@/lib/access/types";

const SECRET = "generate-access-secret";

function req(body: Record<string, unknown>, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.77", ...headers },
    body: JSON.stringify({ topic: "Habits that stick", research: false, ...body }),
  });
}

/** Drain the SSE stream and return the parsed events. */
async function events(res: Response): Promise<Record<string, unknown>[]> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
  }
  return buf
    .split("\n\n")
    .map((p) => p.replace(/^data: /, "").trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

beforeEach(() => {
  resetQuota();
  resetRateLimit();
  setLedger(new MemoryLedger());
  vi.stubEnv("CAROUSEL_LICENSE_SECRET", SECRET);
  // No writer keys: the offline template writer runs, so these tests spend nothing.
  vi.stubEnv("CAROUSEL_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("CAROUSEL_OSS_API_KEY", "");
});

afterEach(() => vi.unstubAllEnvs());

describe("/api/generate enforces the cap server-side", () => {
  it("allows two free carousels, then answers 402 with the reason and the state", async () => {
    expect((await POST(req({}))).status).toBe(200);
    expect((await POST(req({}))).status).toBe(200);

    const third = await POST(req({}));
    expect(third.status).toBe(402);
    const body = (await third.json()) as { error: string; reason: string; state: AccessState };
    expect(body.reason).toBe("cap");
    expect(body.error).toMatch(/licence/i);
    expect(body.state.quota).toMatchObject({ remaining: 0, blocked: true });
  });

  it("cannot be bypassed by a client claiming a plan", async () => {
    await POST(req({ plan: "maker", usage: 0 }));
    await POST(req({ plan: "maker", usage: 0 }));
    const third = await POST(req({ plan: "maker", usage: 0, unlimited: true }));
    expect(third.status).toBe(402);
  });

  it("cannot be bypassed with a forged licence header", async () => {
    const { token } = signLicense({ email: "a@b.com", tier: "maker", seat: 1 }, "not-the-server-secret");
    await POST(req({}, { [LICENSE_HEADER]: token }));
    await POST(req({}, { [LICENSE_HEADER]: token }));
    expect((await POST(req({}, { [LICENSE_HEADER]: token }))).status).toBe(402);
  });

  it("lets a real licence keep going well past the free cap", async () => {
    const { token } = signLicense({ email: "a@b.com", tier: "maker", seat: 1 }, SECRET);
    for (let i = 0; i < 5; i++) {
      const res = await POST(req({}, { [LICENSE_HEADER]: token }));
      expect(res.status, `run ${i}`).toBe(200);
    }
  });

  it("returns the remaining allowance alongside the finished deck", async () => {
    const res = await POST(req({}));
    const deckEvent = (await events(res)).find((e) => e.type === "deck");
    expect(deckEvent).toBeDefined();
    const state = deckEvent!.access as AccessState;
    expect(state.quota.remaining).toBe(1);
    expect(state.quota.used).toBe(1);
  });

  it("counts a bring-your-own-key run against that key, not the network", async () => {
    // Two runs on one key, then a third from the same network with a different
    // key still works — the identity moved with the key.
    const a = { apiKey: "sk-ant-aaaaaaaaaaaaaaaaaaaa" };
    const b = { apiKey: "sk-ant-bbbbbbbbbbbbbbbbbbbb" };
    expect((await POST(req(a))).status).toBe(200);
    expect((await POST(req(a))).status).toBe(200);
    expect((await POST(req(a))).status).toBe(402);
    expect((await POST(req(b))).status).toBe(200);
  });
});
