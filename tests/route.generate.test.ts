import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/generate/route";
import { resetRateLimit } from "@/lib/providers/ratelimit";

/** A stubbed global fetch that answers Wikipedia's two endpoints. */
function wikiFetch() {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/search/page")) {
      return new Response(JSON.stringify({ pages: [{ key: "Habit", title: "Habit" }] }), { status: 200 });
    }
    if (u.includes("/page/summary/")) {
      return new Response(
        JSON.stringify({
          title: "Habit",
          extract:
            "A habit is a routine of behavior repeated regularly and tending to occur subconsciously. Habits form through a loop of cue, routine and reward. A new behavior can take weeks to become automatic. Replacing a habit is easier than removing it.",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Habit" } },
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

async function readSse(res: Response): Promise<Record<string, unknown>[]> {
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

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetRateLimit();
  // Neutralise any ambient keys so tests are deterministic.
  vi.stubEnv("CAROUSEL_API_KEY", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("CAROUSEL_OSS_BASE_URL", "");
  vi.stubEnv("CAROUSEL_OSS_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/generate — input validation", () => {
  it("rejects a missing topic with 400", async () => {
    const res = await POST(req({ research: false }));
    expect(res.status).toBe(400);
  });

  it("rejects invalid JSON with 400", async () => {
    const bad = new Request("http://localhost/api/generate", { method: "POST", body: "{not json" });
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/generate — keyless stream", () => {
  it("streams a keyless notice, sources, and an enriched template deck", async () => {
    vi.stubGlobal("fetch", wikiFetch());
    const res = await POST(req({ topic: "Habits", research: true, slideCount: 6, presetId: "keynote", researchSource: "wikipedia" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");

    const events = await readSse(res);
    expect(events.some((e) => e.type === "notice" && /public sources/i.test(String(e.message)))).toBe(true);
    expect(events.some((e) => e.type === "source")).toBe(true);

    const deckEvent = events.find((e) => e.type === "deck") as { deck: { engineKind: string; enriched: boolean; sources: unknown[] } };
    expect(deckEvent).toBeTruthy();
    expect(deckEvent.deck.engineKind).toBe("template");
    expect(deckEvent.deck.enriched).toBe(true);
    expect(deckEvent.deck.sources.length).toBeGreaterThan(0);
  });
});

describe("POST /api/generate — spend protection", () => {
  it("blocks a server-key request with 429 when the rate limit is hit", async () => {
    vi.stubEnv("CAROUSEL_API_KEY", "sk-ant-server-key");
    vi.stubEnv("CAROUSEL_RATE_PER_MIN", "0"); // block the very first paid request
    const res = await POST(req({ topic: "Anything", research: false, slideCount: 6, presetId: "keynote" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = (await res.json()) as { error: string; limit: string };
    expect(body.limit).toBe("minute");
    expect(body.error).toMatch(/API key/i);
  });

  it("does NOT rate-limit a bring-your-own-key request", async () => {
    vi.stubEnv("CAROUSEL_RATE_PER_MIN", "0");
    // A syntactically valid (fake) key routes to BYOK, which bypasses the limiter.
    // We stub fetch so the (unreachable-in-this-test) model path can't hit the network.
    vi.stubGlobal("fetch", wikiFetch());
    const key = "sk-ant-" + "a".repeat(40);
    const res = await POST(req({ topic: "Anything", research: false, slideCount: 6, presetId: "keynote", apiKey: key }));
    // Not a 429 — the request is allowed to proceed (it streams, even if the fake key later fails).
    expect(res.status).toBe(200);
  });
});
