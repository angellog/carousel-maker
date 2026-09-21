import { describe, expect, it } from "vitest";
import { resolveConfig, pickResearchSource, type Env } from "@/lib/providers/config";
import type { GenerateInput } from "@/lib/content/prompt";

const KEY = "sk-ant-" + "a".repeat(40); // passes sanitizeKey

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return { topic: "Photosynthesis", slideCount: 8, presetId: "keynote", research: true, ...over };
}

const OSS: Env = {
  CAROUSEL_OSS_BASE_URL: "https://api.groq.com/openai/v1",
  CAROUSEL_OSS_MODEL: "llama-3.3-70b-versatile",
  CAROUSEL_OSS_API_KEY: "gsk_live_xxx",
};

describe("resolveConfig — writer precedence", () => {
  it("prefers a bring-your-own key (Claude, billed to the user)", () => {
    const c = resolveConfig(input({ apiKey: KEY }), { ...OSS, CAROUSEL_API_KEY: "sk-ant-server" });
    expect(c.writer.kind).toBe("claude");
    expect(c.writer.byok).toBe(true);
    expect(c.writer.serverPaid).toBe(false);
    expect(c.writer.apiKey).toBe(KEY);
  });

  it("uses a server Anthropic key next (Claude, billed to us)", () => {
    const c = resolveConfig(input(), { CAROUSEL_API_KEY: "sk-ant-server", ...OSS });
    expect(c.writer.kind).toBe("claude");
    expect(c.writer.byok).toBe(false);
    expect(c.writer.serverPaid).toBe(true);
  });

  it("falls to a configured OpenAI-compatible endpoint", () => {
    const c = resolveConfig(input(), OSS);
    expect(c.writer.kind).toBe("openai");
    expect(c.writer.baseUrl).toBe(OSS.CAROUSEL_OSS_BASE_URL);
    expect(c.writer.model).toBe(OSS.CAROUSEL_OSS_MODEL);
    expect(c.writer.serverPaid).toBe(true); // a hosted key costs us money
  });

  it("treats a keyless OSS endpoint (local Ollama) as not server-paid", () => {
    const c = resolveConfig(input(), { CAROUSEL_OSS_BASE_URL: "http://localhost:11434/v1", CAROUSEL_OSS_MODEL: "llama3" });
    expect(c.writer.kind).toBe("openai");
    expect(c.writer.serverPaid).toBe(false);
  });

  it("falls back to the keyless template writer when nothing is configured", () => {
    const c = resolveConfig(input(), {});
    expect(c.writer.kind).toBe("template");
    expect(c.writer.serverPaid).toBe(false);
  });

  it("labels the OSS engine from the model and host", () => {
    const c = resolveConfig(input(), OSS);
    expect(c.writer.label).toMatch(/llama-3\.3-70b-versatile/);
    expect(c.writer.label).toMatch(/Groq/);
  });

  it("scrubs a stray invisible character from a pasted OSS key", () => {
    // A key copy-pasted into a dashboard can pick up a U+2028 line separator,
    // which would crash the Authorization header. It must be stripped, and the
    // endpoint must still count as configured + server-paid.
    const dirty = "gsk_live_" + "a".repeat(47) + " ";
    const c = resolveConfig(input(), { ...OSS, CAROUSEL_OSS_API_KEY: dirty });
    expect(c.writer.kind).toBe("openai");
    expect(c.writer.serverPaid).toBe(true);
    expect(c.writer.apiKey).toBe("gsk_live_" + "a".repeat(47));
    expect(/[^\x21-\x7E]/.test(c.writer.apiKey ?? "")).toBe(false);
  });
});

describe("resolveConfig — research axis", () => {
  it("gives Claude no pre-fetched research (it searches itself)", () => {
    const c = resolveConfig(input({ apiKey: KEY, research: true }), {});
    expect(c.research).toBe("none");
  });

  it("no longer pre-fetches a keyless source for the template writer", () => {
    const c = resolveConfig(input({ research: true }), {});
    expect(c.writer.kind).toBe("template");
    expect(c.research).toBe("none");
  });

  it("no longer pre-fetches for the OSS writer (it researches from its own knowledge)", () => {
    const c = resolveConfig(input({ research: true }), OSS);
    expect(c.writer.kind).toBe("openai");
    expect(c.research).toBe("none");
  });

  it("is 'none' when research is off", () => {
    const c = resolveConfig(input({ research: false }), OSS);
    expect(c.research).toBe("none");
  });

  it("pickResearchSource is web-only now, or none when off", () => {
    expect(pickResearchSource(input({ research: true }), {})).toBe("web");
    expect(pickResearchSource(input({ research: false }), {})).toBe("none");
  });
});
