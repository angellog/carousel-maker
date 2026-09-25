import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { generateDeck } from "@/lib/providers";
import type { Env } from "@/lib/providers/config";
import type { ProviderEvent } from "@/lib/providers";
import { MemoryLedger, setLedger } from "@/lib/access/ledger";
import { describe as describeAccess } from "@/lib/access";
import { resetQuota } from "@/lib/access/quota";
import { resetRateLimit } from "@/lib/providers/ratelimit";

const OSS_ENV: Env = {
  CAROUSEL_OSS_BASE_URL: "https://api.groq.test/openai/v1",
  CAROUSEL_OSS_MODEL: "openai/gpt-oss-120b",
  CAROUSEL_OSS_API_KEY: "gsk_test",
  CAROUSEL_OSS_LABEL: "gpt-oss-120b · Groq",
};

/** Groq's real rate-limit body — note that it contains the word "model". */
const RATE_LIMITED = JSON.stringify({
  error: {
    message: "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` on tokens per minute.",
    type: "tokens",
    code: "rate_limit_exceeded",
  },
});

async function writeWith(
  fetchImpl: typeof fetch,
  input: Record<string, unknown> = {},
): Promise<{ notices: string[]; offline: boolean | undefined }> {
  const notices: string[] = [];
  const emit = (e: ProviderEvent) => {
    if (e.type === "notice") notices.push(e.message);
  };
  const { deck } = await generateDeck({
    input: { topic: "Sleep myths that cost you rest", slideCount: 6, presetId: "swiss", research: false, ...input },
    env: OSS_ENV,
    emit,
    fetchImpl,
  });
  return { notices, offline: deck.offline };
}

beforeEach(() => {
  resetQuota();
  resetRateLimit();
  setLedger(new MemoryLedger());
});

describe("a rate-limited free engine", () => {
  it("is reported as busy, not as a broken model id", async () => {
    const f = vi.fn(async () => new Response(RATE_LIMITED, { status: 429 })) as unknown as typeof fetch;
    const { notices, offline } = await writeWith(f);

    expect(offline).toBe(true);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/busy right now/i);
    // The old message sent people to fix configuration that was never wrong.
    expect(notices[0]).not.toMatch(/CAROUSEL_OSS_MODEL/);
    expect(notices[0]).toMatch(/own API key/i);
  });

  it("waits the Retry-After the host asks for, when it is short", async () => {
    let calls = 0;
    const f = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? new Response(RATE_LIMITED, { status: 429, headers: { "retry-after": "1" } })
        : new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: {
                          name: "submit_deck",
                          arguments: JSON.stringify({
                            topic: "Sleep myths that cost you rest",
                            angle: "What common sleep advice gets wrong",
                            audience: "people who sleep badly",
                            slides: [
                              { role: "cover", title: "Five sleep myths that cost you rest" },
                              { role: "body", title: "Eight hours is an average, not a rule" },
                              { role: "body", title: "Weekend catch-up sleep is not a reset" },
                              { role: "cta", title: "Pick one myth to drop tonight" },
                            ],
                            caption: "A short deck on what sleep advice gets wrong.",
                            hashtags: ["sleep", "health"],
                          }),
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 },
          );
    }) as unknown as typeof fetch;

    const started = Date.now();
    const { offline, notices } = await writeWith(f);
    const elapsed = Date.now() - started;

    expect(calls).toBe(2);
    expect(offline).toBeFalsy();
    expect(notices).toEqual([]);
    expect(elapsed).toBeGreaterThanOrEqual(900);
  });

  it("gives up at once when the host asks for longer than we'll hold the request", async () => {
    const f = vi.fn(async () => new Response(RATE_LIMITED, { status: 429, headers: { "retry-after": "60" } })) as unknown as typeof fetch;
    const started = Date.now();
    const { offline } = await writeWith(f);

    // One attempt, no pointless sleeping through a minute-long limit.
    expect((f as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(500);
    expect(offline).toBe(true);
  });

  it("still names a genuinely wrong model id", async () => {
    const body = JSON.stringify({ error: { message: "The model `nope-8b` does not exist" } });
    const f = vi.fn(async () => new Response(body, { status: 404 })) as unknown as typeof fetch;
    const { notices } = await writeWith(f);
    expect(notices[0]).toMatch(/CAROUSEL_OSS_MODEL/);
  });

  it("still names a rejected key", async () => {
    const f = vi.fn(async () => new Response("invalid api key", { status: 401 })) as unknown as typeof fetch;
    const { notices } = await writeWith(f);
    expect(notices[0]).toMatch(/CAROUSEL_OSS_API_KEY/);
  });
});

describe("a failed carousel is not charged to the visitor", () => {
  const headers = { "x-forwarded-for": "198.51.100.42", "Content-Type": "application/json" };

  function req() {
    return new Request("http://localhost/api/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({ topic: "Sleep myths that cost you rest", research: false, slideCount: 6 }),
    });
  }

  async function remaining() {
    const { state } = await describeAccess(new Headers(headers));
    return state.quota.remaining;
  }

  it("refunds the slot when the engine fails and only a skeleton comes back", async () => {
    vi.stubEnv("CAROUSEL_OSS_BASE_URL", OSS_ENV.CAROUSEL_OSS_BASE_URL!);
    vi.stubEnv("CAROUSEL_OSS_MODEL", OSS_ENV.CAROUSEL_OSS_MODEL!);
    vi.stubEnv("CAROUSEL_OSS_API_KEY", OSS_ENV.CAROUSEL_OSS_API_KEY!);
    vi.stubEnv("CAROUSEL_API_KEY", "");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(RATE_LIMITED, { status: 429 })),
    );

    expect(await remaining()).toBe(2);

    const res = await POST(req());
    expect(res.status).toBe(200);
    await res.text(); // drain the stream so the handler completes

    // The visitor got a placeholder, so they still have both carousels.
    expect(await remaining()).toBe(2);

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
