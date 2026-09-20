import { describe, expect, it } from "vitest";
import { clampWords, deckSchema, missingFields, normalizeDeck, normalizeHashtag, unescapeText, wordCount, MAX_TITLE_WORDS } from "@/lib/content/schema";
import { writeOfflineDeck } from "@/lib/content/offline";
import { PRESETS, getPreset } from "@/lib/presets";
import { plain } from "@/lib/render/text";
import { captionFile, slugify } from "@/lib/export/index";
import { friendlyError, maskKey, sanitizeKey } from "@/lib/content/errors";

const fallback = { handle: "@me", topic: "a topic" };

describe("deck schema", () => {
  it("rejects a deck with too few slides", () => {
    expect(deckSchema.safeParse({ topic: "t", angle: "a", audience: "x", slides: [] }).success).toBe(false);
  });

  it("accepts a minimal valid deck", () => {
    const r = deckSchema.safeParse({
      topic: "t",
      angle: "a",
      audience: "x",
      slides: [{ title: "one" }, { title: "two" }, { title: "three" }],
    });
    expect(r.success).toBe(true);
  });
});

describe("normalizeDeck", () => {
  const raw = {
    topic: "Morning routines",
    angle: "They fail for structural reasons",
    audience: "restarters",
    slides: [{ title: "Cover" }, { title: "Body" }, { title: "End" }],
  };

  it("assigns ids and cover/body/cta roles", () => {
    const { deck } = normalizeDeck(raw, fallback);
    expect(deck.slides.map((s) => s.role)).toEqual(["cover", "body", "cta"]);
    expect(new Set(deck.slides.map((s) => s.id)).size).toBe(3);
  });

  it("keeps an explicitly supplied role", () => {
    const { deck } = normalizeDeck(
      { ...raw, slides: [{ title: "a", role: "body" as const }, { title: "b" }, { title: "c" }] },
      fallback,
    );
    expect(deck.slides[0].role).toBe("body");
  });

  it("trims over-long headlines and reports the issue", () => {
    const long = Array.from({ length: 30 }, (_, i) => `w${i}`).join(" ");
    const { deck, issues } = normalizeDeck({ ...raw, slides: [{ title: long }, { title: "b" }, { title: "c" }] }, fallback);
    expect(wordCount(deck.slides[0].title)).toBeLessThanOrEqual(MAX_TITLE_WORDS);
    expect(issues[0].field).toBe("title");
  });

  it("drops empty arrays so presets can rely on truthiness", () => {
    const { deck } = normalizeDeck(
      { ...raw, slides: [{ title: "a", bullets: ["", "  "] }, { title: "b" }, { title: "c" }] },
      fallback,
    );
    expect(deck.slides[0].bullets).toBeUndefined();
  });

  it("normalises hashtags and falls back to the supplied handle", () => {
    const { deck } = normalizeDeck({ ...raw, hashtags: ["one", "#two"] }, fallback);
    expect(deck.hashtags).toEqual(["#one", "#two"]);
    expect(deck.handle).toBe("@me");
  });

  it("substitutes the fallback topic for an empty title", () => {
    const { deck } = normalizeDeck({ ...raw, slides: [{ title: "  " }, { title: "b" }, { title: "c" }] }, fallback);
    expect(deck.slides[0].title).toBe("a topic");
  });
});

describe("clampWords", () => {
  it("leaves short strings alone", () => {
    expect(clampWords("one two", 5)).toBe("one two");
  });

  it("re-closes markup severed by the cut", () => {
    const out = clampWords("keep **this and that and more**", 3);
    expect(out.split("**").length - 1).toBe(2);
    expect(plain(out).split(/\s+/)).toHaveLength(3);
  });
});

describe("offline writer", () => {
  it("produces a valid, renderable deck for every preset", () => {
    for (const p of PRESETS) {
      const deck = writeOfflineDeck({ topic: "Test topic", handle: "@x", preset: p, slideCount: 9 });
      expect(deck.slides, p.id).toHaveLength(9);
      expect(deck.slides[0].role).toBe("cover");
      expect(deck.slides.at(-1)!.role).toBe("cta");
      expect(deck.offline).toBe(true);
      for (const s of deck.slides) {
        expect(wordCount(s.title), `${p.id}: "${s.title}"`).toBeLessThanOrEqual(MAX_TITLE_WORDS);
      }
    }
  });

  it("fills the fields the chosen preset actually renders", () => {
    for (const p of PRESETS) {
      const deck = writeOfflineDeck({ topic: "Test", preset: p, slideCount: 8 });
      // Ignore fields the cover/CTA supply rather than the body frames.
      const structural = p.needs.filter((f) => !["kicker", "body", "note"].includes(f));
      expect(missingFields(deck, structural), p.id).toEqual([]);
    }
  });

  it("clamps the slide count into a postable range", () => {
    const p = getPreset("keynote");
    expect(writeOfflineDeck({ topic: "t", preset: p, slideCount: 1 }).slides.length).toBe(4);
    expect(writeOfflineDeck({ topic: "t", preset: p, slideCount: 99 }).slides.length).toBe(12);
  });

  it("never invents a statistic — the skeleton stat is an honest prompt, not a fake number", () => {
    const p = getPreset("datacard");
    const deck = writeOfflineDeck({ topic: "t", preset: p, slideCount: 8 });
    for (const s of deck.slides) {
      if (s.stat) {
        // A draft-skeleton stat reads as a fillable prompt, never a fabricated figure.
        expect(/\d/.test(s.stat.value)).toBe(false);
        expect(s.stat.value.toLowerCase()).toContain("stat");
      }
    }
  });

  it("uses a real figure from research on a data template, not a placeholder", () => {
    const p = getPreset("datacard");
    const research = {
      lead: "",
      facts: ["Its mirror spans 6.5 metres across.", "It cost about 10 billion dollars.", "Launched in 2021."],
      factSources: [0, 0, 0],
      sources: [{ title: "JWST", url: "https://en.wikipedia.org/wiki/JWST" }],
      descriptions: [],
    };
    const deck = writeOfflineDeck({ topic: "James Webb Space Telescope", preset: p, slideCount: 6, research });
    const stats = deck.slides.filter((s) => s.stat).map((s) => s.stat!.value);
    // At least one data slide shows a real number pulled from the facts.
    expect(stats.some((v) => /\d/.test(v))).toBe(true);
    // And none of them is the fabricated "00%".
    expect(stats.some((v) => v === "00%")).toBe(false);
  });

  it("is deterministic for the same input", () => {
    const a = writeOfflineDeck({ topic: "same", preset: PRESETS[0], slideCount: 7 });
    const b = writeOfflineDeck({ topic: "same", preset: PRESETS[0], slideCount: 7 });
    expect(a).toEqual(b);
  });
});

describe("export helpers", () => {
  it("slugifies safely and never returns an empty name", () => {
    expect(slugify("Hello, **World**!")).toBe("hello-world");
    expect(slugify("   ")).toBe("carousel");
    expect(slugify("!!!")).toBe("carousel");
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(48);
  });

  it("writes caption, hashtags, sources and the offline disclaimer", () => {
    const deck = writeOfflineDeck({ topic: "t", preset: PRESETS[0], slideCount: 6 });
    const out = captionFile({ ...deck, sources: [{ title: "Src", url: "https://e.com" }] });
    expect(out).toContain("#carousel");
    expect(out).toContain("https://e.com");
    expect(out).toContain("Draft skeleton");
  });

  it("omits the disclaimer for a model-written deck", () => {
    const deck = writeOfflineDeck({ topic: "t", preset: PRESETS[0], slideCount: 6 });
    expect(captionFile({ ...deck, offline: false })).not.toContain("Draft skeleton");
  });
});

describe("tolerating model shape variance", () => {
  const base = { topic: "t", angle: "a", audience: "x" };

  it("accepts a newline-separated string where bullets should be an array", () => {
    const r = deckSchema.safeParse({
      ...base,
      slides: [{ title: "a", bullets: "one\ntwo\nthree" }, { title: "b" }, { title: "c" }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.slides[0].bullets).toEqual(["one", "two", "three"]);
  });

  it("accepts a comma-separated string too", () => {
    const r = deckSchema.safeParse({
      ...base,
      slides: [{ title: "a", bullets: "one, two, three" }, { title: "b" }, { title: "c" }],
    });
    expect(r.success && r.data.slides[0].bullets).toEqual(["one", "two", "three"]);
  });

  it("splits a whitespace-separated hashtag string", () => {
    const r = deckSchema.safeParse({
      ...base,
      hashtags: "#one #two #three",
      slides: [{ title: "a" }, { title: "b" }, { title: "c" }],
    });
    expect(r.success && r.data.hashtags).toEqual(["#one", "#two", "#three"]);
  });

  it("wraps a lone object where a list of objects is expected", () => {
    const r = deckSchema.safeParse({
      ...base,
      slides: [
        { title: "a", steps: { label: "L", text: "T" }, items: { label: "K", value: "V" } },
        { title: "b" },
        { title: "c" },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slides[0].steps).toHaveLength(1);
      expect(r.data.slides[0].items).toHaveLength(1);
    }
  });

  it("still rejects genuinely broken input", () => {
    expect(deckSchema.safeParse({ ...base, slides: [{ title: 42 }] }).success).toBe(false);
    expect(deckSchema.safeParse({ ...base, slides: [{ title: "only one" }] }).success).toBe(false);
  });

  it("defaults a missing code language rather than failing", () => {
    const r = deckSchema.safeParse({
      ...base,
      slides: [{ title: "a", code: { lines: "echo hi" } }, { title: "b" }, { title: "c" }],
    });
    expect(r.success && r.data.slides[0].code).toEqual({ lang: "text", lines: ["echo hi"] });
  });
});

describe("hashtags", () => {
  it("parses a stringified JSON array without leaving quotes or brackets", () => {
    const r = deckSchema.safeParse({
      topic: "t",
      angle: "a",
      audience: "x",
      hashtags: '["morningroutine", "habitbuilding", "tinyhabits"]',
      slides: [{ title: "a" }, { title: "b" }, { title: "c" }],
    });
    expect(r.success && r.data.hashtags).toEqual(["morningroutine", "habitbuilding", "tinyhabits"]);
  });

  it("normalises to lowercase, single-hash, alphanumeric tags", () => {
    expect(normalizeHashtag("My Tag!")).toBe("#mytag");
    expect(normalizeHashtag("##Already")).toBe("#already");
    expect(normalizeHashtag('"quoted"')).toBe("#quoted");
    expect(normalizeHashtag("!!!")).toBeNull();
    expect(normalizeHashtag("café")).toBe("#café");
  });

  it("de-duplicates and caps at twelve", () => {
    const { deck } = normalizeDeck(
      {
        topic: "t",
        angle: "a",
        audience: "x",
        hashtags: ["a", "#A", "b", ...Array.from({ length: 20 }, (_, i) => `t${i}`)],
        slides: [{ title: "a" }, { title: "b" }, { title: "c" }],
      },
      { handle: "@me", topic: "t" },
    );
    expect(deck.hashtags).toHaveLength(12);
    expect(deck.hashtags.filter((h) => h === "#a")).toHaveLength(1);
  });
});

describe("escaped text", () => {
  it("turns a literal backslash-n into a real line break", () => {
    expect(unescapeText("one\\ntwo")).toBe("one\ntwo");
    expect(unescapeText("a\\nb\\nc")).toBe("a\nb\nc");
  });

  it("unescapes quotes as well as newlines", () => {
    expect(unescapeText('asks \\"what\'s your rate?\\"')).toBe('asks "what\'s your rate?"');
  });

  it("leaves ordinary text untouched", () => {
    expect(unescapeText("no escapes here")).toBe("no escapes here");
    expect(unescapeText("already\nreal")).toBe("already\nreal");
  });

  it("applies to captions and slide copy on the way through normalizeDeck", () => {
    const { deck } = normalizeDeck(
      {
        topic: "t",
        angle: "a",
        audience: "x",
        caption: "line one\\n\\nline two",
        slides: [
          { title: "head\\nline", body: "body\\nbreak" },
          { title: "b" },
          { title: "c" },
        ],
      },
      { handle: "@me", topic: "t" },
    );
    expect(deck.caption).toBe("line one\n\nline two");
    expect(deck.slides[0].title).toBe("head\nline");
    expect(deck.slides[0].body).toBe("body\nbreak");
  });
});

describe("friendlyError", () => {
  const apiErr = (message: string, status?: number) =>
    Object.assign(new Error(message), status === undefined ? {} : { status });

  it("explains an empty credit balance and where to fix it", () => {
    const m = friendlyError(
      apiErr('400 {"type":"error","error":{"message":"Your credit balance is too low to access the Anthropic API."}}', 400),
    );
    expect(m).toMatch(/no credits left/i);
    expect(m).toContain("console.anthropic.com");
    expect(m).toMatch(/billed separately/i);
    expect(m).not.toContain("{");
  });

  it("distinguishes a rejected key from a billing problem", () => {
    expect(friendlyError(apiErr("authentication_error: invalid x-api-key", 401))).toMatch(/rejected/i);
    expect(friendlyError(apiErr("permission denied", 403))).toMatch(/not allowed/i);
  });

  it("tells the user to wait on a rate limit", () => {
    expect(friendlyError(apiErr("rate_limit_error", 429))).toMatch(/wait a moment/i);
  });

  it("names the model when it does not exist", () => {
    expect(friendlyError(apiErr("model not found", 404), "claude-nope")).toContain("claude-nope");
  });

  it("treats any 5xx as transient", () => {
    expect(friendlyError(apiErr("overloaded_error", 529))).toMatch(/temporarily unavailable/i);
    expect(friendlyError(apiErr("internal", 500))).toMatch(/temporarily unavailable/i);
  });

  it("catches network failures that carry no status", () => {
    expect(friendlyError(new TypeError("fetch failed"))).toMatch(/network connection/i);
    expect(friendlyError(apiErr("getaddrinfo ENOTFOUND api.anthropic.com"))).toMatch(/network connection/i);
  });

  it("passes an unrecognised message through rather than hiding it", () => {
    expect(friendlyError(new Error("something odd happened"))).toBe("something odd happened");
    expect(friendlyError("a bare string")).toBe("a bare string");
  });
});

describe("sanitizeKey", () => {
  const good = "sk-ant-api03-" + "a".repeat(80);

  it("accepts a plausible key and trims whitespace and quotes", () => {
    expect(sanitizeKey(good)).toBe(good);
    expect(sanitizeKey(`  ${good}  `)).toBe(good);
    expect(sanitizeKey(`"${good}"`)).toBe(good);
    expect(sanitizeKey(`'${good}'`)).toBe(good);
  });

  it("rejects anything that is not an Anthropic key", () => {
    expect(sanitizeKey("hello")).toBeUndefined();
    expect(sanitizeKey("sk-proj-" + "a".repeat(80))).toBeUndefined();
    expect(sanitizeKey("")).toBeUndefined();
    expect(sanitizeKey(undefined)).toBeUndefined();
    expect(sanitizeKey(null)).toBeUndefined();
    expect(sanitizeKey(12345)).toBeUndefined();
    expect(sanitizeKey({ key: good })).toBeUndefined();
  });

  it("rejects keys with embedded whitespace or absurd length", () => {
    expect(sanitizeKey("sk-ant-" + "a".repeat(50) + " rm -rf /")).toBeUndefined();
    expect(sanitizeKey("sk-ant-short")).toBeUndefined();
    expect(sanitizeKey("sk-ant-" + "a".repeat(500))).toBeUndefined();
  });

  it("masks to the last four characters only", () => {
    expect(maskKey(good)).toBe("…aaaa");
    expect(maskKey("sk-ant-api03-WXYZ")).toBe("…WXYZ");
    expect(maskKey(good)).not.toContain("sk-ant");
  });
});
