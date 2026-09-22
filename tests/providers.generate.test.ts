import { describe, expect, it, vi } from "vitest";
import { generateDeck } from "@/lib/providers/generate";
import type { Env } from "@/lib/providers/config";
import type { ProviderEvent } from "@/lib/providers/types";
import type { GenerateInput } from "@/lib/content/prompt";

const WIKI_EXTRACT =
  "A habit is a routine of behavior repeated regularly and tending to occur subconsciously. Habits form through a loop of cue, routine and reward over time. Studies suggest a new behavior can take weeks to become automatic. Replacing a habit is easier than removing one entirely.";

const MODEL_DECK = {
  topic: "Habits",
  angle: "Small loops, big change",
  audience: "anyone",
  slides: [
    { role: "cover", title: "How habits really form" },
    { role: "body", title: "Cue, routine, reward" },
    { role: "body", title: "Automaticity takes weeks" },
    { role: "cta", title: "Start one tiny loop" },
  ],
  caption: "A quick guide to habits.",
  hashtags: ["habits"],
};

/** One fetch stub that answers Wikipedia, DuckDuckGo, and the chat endpoint. */
function stub(chat: "deck" | "500") {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/search/page")) {
      return new Response(JSON.stringify({ pages: [{ key: "Habit", title: "Habit" }] }), { status: 200 });
    }
    if (u.includes("/page/summary/")) {
      return new Response(
        JSON.stringify({
          title: "Habit",
          extract: WIKI_EXTRACT,
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Habit" } },
        }),
        { status: 200 },
      );
    }
    if (u.includes("/chat/completions")) {
      void init;
      if (chat === "500") return new Response("upstream boom", { status: 500 });
      return new Response(
        JSON.stringify({
          choices: [{ message: { tool_calls: [{ function: { name: "submit_deck", arguments: JSON.stringify(MODEL_DECK) } }] } }],
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

function run(input: GenerateInput, env: Env, fetchImpl: typeof fetch) {
  const events: ProviderEvent[] = [];
  return generateDeck({ input, env, emit: (e) => events.push(e), fetchImpl }).then((out) => ({ ...out, events }));
}

const base: GenerateInput = { topic: "Habits", slideCount: 6, presetId: "keynote", research: true };

describe("generateDeck — keyless template path", () => {
  it("writes a keyless draft deck without any pre-fetched research", async () => {
    const out = await run(base, {}, stub("deck"));
    expect(out.config.writer.kind).toBe("template");
    expect(out.deck.engineKind).toBe("template");
    expect(out.deck.offline).toBe(true);
    // Keyless Wikipedia research was retired, so the template writer produces an
    // honest draft skeleton, not enriched facts, and cites nothing.
    expect(out.config.research).toBe("none");
    expect(out.deck.enriched).toBe(false);
    expect(out.events.some((e) => e.type === "source")).toBe(false);
  });
});

describe("generateDeck — OSS writer path", () => {
  const OSS: Env = {
    CAROUSEL_OSS_BASE_URL: "https://api.groq.com/openai/v1",
    CAROUSEL_OSS_MODEL: "llama-3.3-70b",
    CAROUSEL_OSS_API_KEY: "gsk_test",
  };

  it("grounds an OSS model on research and returns its deck", async () => {
    const out = await run(base, OSS, stub("deck"));
    expect(out.config.writer.kind).toBe("openai");
    expect(out.deck.engineKind).toBe("openai");
    expect(out.deck.topic).toBe("Habits");
  });

  it("falls back to an honest template draft when the OSS endpoint fails", async () => {
    const out = await run(base, OSS, stub("500"));
    // The model failed, so the user gets a clean, renderable skeleton to edit —
    // never Wikipedia/DuckDuckGo slop pulled in as a stand-in for the model.
    expect(out.deck.engineKind).toBe("template");
    expect(out.deck.enriched).toBe(false);
    expect(out.deck.sources.length).toBe(0);
    expect(out.events.some((e) => e.type === "notice" && /built-in draft/i.test(e.message))).toBe(true);
    expect(out.events.some((e) => e.type === "source")).toBe(false);
  });
});
