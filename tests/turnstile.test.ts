import { describe, expect, it, vi } from "vitest";
import { verifyTurnstile, turnstileSecretFromEnv } from "@/lib/turnstile";

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as unknown as Response;
}

describe("turnstile verification", () => {
  it("skips (ok) when no secret is configured — local/dev fail-open by config", async () => {
    const spy = vi.fn();
    const r = await verifyTurnstile("tok", undefined, undefined, spy as unknown as typeof fetch);
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("disabled");
    expect(spy).not.toHaveBeenCalled();
  });

  it("fails when the secret is set but no token is supplied", async () => {
    const spy = vi.fn();
    const r = await verifyTurnstile(undefined, "secret", undefined, spy as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("missing-token");
    expect(spy).not.toHaveBeenCalled();
  });

  it("verifies a good token against Cloudflare", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    const r = await verifyTurnstile("good", "secret", "1.2.3.4", fetchImpl as unknown as typeof fetch);
    expect(r.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).toContain("response=good");
    expect(String(init.body)).toContain("remoteip=1.2.3.4");
  });

  it("rejects a bad token and surfaces the error codes", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));
    const r = await verifyTurnstile("bad", "secret", undefined, fetchImpl as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid-input-response");
  });

  it("soft-fails (not ok) when the verifier is unreachable — no free pass", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    const r = await verifyTurnstile("tok", "secret", undefined, fetchImpl as unknown as typeof fetch);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("verify-unreachable");
  });

  it("omits the anonymous sentinel from remoteip", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ success: true }));
    await verifyTurnstile("t", "secret", "anonymous", fetchImpl as unknown as typeof fetch);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(init.body)).not.toContain("remoteip");
  });

  it("reads the secret from the environment", () => {
    expect(turnstileSecretFromEnv({ TURNSTILE_SECRET: "x" })).toBe("x");
    expect(turnstileSecretFromEnv({ TURNSTILE_SECRET: "  " })).toBeUndefined();
    expect(turnstileSecretFromEnv({})).toBeUndefined();
  });
});
