import { describe, expect, it, vi } from "vitest";
import { makeOpenAIWriter, extractJsonObject } from "@/lib/providers/writers/openai";
import { templateWriter } from "@/lib/providers/writers/template";
import { getPreset } from "@/lib/presets";
import type { WriterConfig } from "@/lib/providers/config";
import type { ProviderEvent, WriteContext } from "@/lib/providers/types";
import type { GenerateInput } from "@/lib/content/prompt";

const DECK = {
  topic: "Photosynthesis",
  angle: "How plants eat light",
  audience: "curious beginners",
  slides: [
    { role: "cover", title: "How plants eat light" },
    { role: "body", title: "Chloroplasts capture photons" },
    { role: "body", title: "Water is split for electrons" },
    { role: "cta", title: "Look at a leaf differently" },
  ],
  caption: "A short thread on photosynthesis.",
  hashtags: ["science", "biology"],
};

const OSS_CONFIG: WriterConfig = {
  kind: "openai",
  label: "Llama 3.3 (groq.com)",
  model: "llama-3.3-70b",
  apiKey: "gsk_test",
  baseUrl: "https://api.groq.com/openai/v1",
  byok: false,
  serverPaid: true,
};

function ctx(over: Partial<WriteContext> = {}): { context: WriteContext; events: ProviderEvent[] } {
  const events: ProviderEvent[] = [];
  const input: GenerateInput = { topic: "Photosynthesis", slideCount: 6, presetId: "keynote", research: false };
  const context: WriteContext = {
    input,
    preset: getPreset("keynote"),
    slideCount: 6,
    emit: (e) => events.push(e),
    fetchImpl: over.fetchImpl ?? (vi.fn() as unknown as typeof fetch),
    ...over,
  };
  return { context, events };
}

function jsonResponse(bodyObj: unknown, status = 200) {
  return new Response(JSON.stringify(bodyObj), { status, headers: { "Content-Type": "application/json" } });
}

describe("extractJsonObject", () => {
  it("pulls a balanced object out of surrounding prose", () => {
    const s = 'Sure! Here is the deck:\n```json\n{"a":1,"b":{"c":2}}\n``` done';
    expect(extractJsonObject(s)).toBe('{"a":1,"b":{"c":2}}');
  });
  it("ignores braces inside strings", () => {
    expect(extractJsonObject('{"t":"a } b"}')).toBe('{"t":"a } b"}');
  });
  it("returns null when there is no object", () => {
    expect(extractJsonObject("no json here")).toBeNull();
  });
});

describe("openai writer", () => {
  it("parses a submit_deck tool call into a valid deck", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { tool_calls: [{ function: { name: "submit_deck", arguments: JSON.stringify(DECK) } }] } }],
      }),
    ) as unknown as typeof fetch;
    const { context, events } = ctx({ fetchImpl });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(res).not.toBeNull();
    expect(res!.deck.slides.length).toBe(4);
    expect(res!.deck.engineKind).toBe("openai");
    expect(res!.deck.engine).toBe(OSS_CONFIG.label);
    // It POSTed to the configured base URL with a bearer token.
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer gsk_test" });
    expect(events.some((e) => e.type === "phase" && e.phase === "writing")).toBe(true);
  });

  it("falls back to parsing JSON from message content when there is no tool call", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { content: "Here you go:\n" + JSON.stringify(DECK) } }] }),
    ) as unknown as typeof fetch;
    const { context } = ctx({ fetchImpl });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(res).not.toBeNull();
    expect(res!.deck.topic).toBe("Photosynthesis");
  });

  it("grounds the prompt on researched facts but cites only the model's own sources", async () => {
    // The model is grounded on the facts, and it may cite its own sources — but
    // the fetched research sources are NOT auto-attached, so an irrelevant
    // keyless hit can never become a false citation on the deck.
    const modelDeck = { ...DECK, sources: [{ title: "Photosynthesis", url: "https://en.wikipedia.org/wiki/Photosynthesis" }] };
    let sentBody = "";
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      sentBody = String(init.body);
      return jsonResponse({
        choices: [{ message: { tool_calls: [{ function: { name: "submit_deck", arguments: JSON.stringify(modelDeck) } }] } }],
      });
    }) as unknown as typeof fetch;
    const research = {
      lead: "Plants convert light to chemical energy.",
      facts: ["Photosynthesis releases oxygen as a byproduct.", "Chlorophyll absorbs red and blue light."],
      sources: [{ title: "Giant oarfish", url: "https://en.wikipedia.org/wiki/Giant_oarfish" }],
      descriptions: [],
    };
    const { context } = ctx({ fetchImpl, research, input: { topic: "Photosynthesis", slideCount: 6, presetId: "keynote", research: true } });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(sentBody).toContain("releases oxygen"); // grounded on the facts
    expect(res!.deck.sources).toEqual(modelDeck.sources); // the model's own citation
    expect(res!.deck.sources.map((s) => s.title)).not.toContain("Giant oarfish"); // no false citation
  });

  it("adds no sources when the model cites none (never fabricates citations)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ choices: [{ message: { tool_calls: [{ function: { name: "submit_deck", arguments: JSON.stringify(DECK) } }] } }] }),
    ) as unknown as typeof fetch;
    const research = {
      lead: "x",
      facts: ["a fact"],
      sources: [{ title: "Porphyria", url: "https://en.wikipedia.org/wiki/Porphyria" }],
      descriptions: [],
    };
    const { context } = ctx({ fetchImpl, research, input: { topic: "Intermittent fasting", slideCount: 6, presetId: "keynote", research: true } });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(res!.deck.sources).toEqual([]);
  });

  it("returns null and emits a helpful notice on an auth error", async () => {
    const fetchImpl = vi.fn(async () => new Response("invalid api key", { status: 401 })) as unknown as typeof fetch;
    const { context, events } = ctx({ fetchImpl });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(res).toBeNull();
    expect(events.some((e) => e.type === "notice" && /key/i.test(e.message))).toBe(true);
  });

  it("returns null on a network throw without crashing", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const { context, events } = ctx({ fetchImpl });
    const res = await makeOpenAIWriter(OSS_CONFIG).write(context);
    expect(res).toBeNull();
    expect(events.some((e) => e.type === "notice")).toBe(true);
  });
});

describe("template writer", () => {
  it("stamps engine provenance and stays keyless", async () => {
    const { context } = ctx();
    const res = await templateWriter.write(context);
    expect(res!.deck.engineKind).toBe("template");
    expect(res!.deck.offline).toBe(true);
  });
});
