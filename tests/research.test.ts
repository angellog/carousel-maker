import { describe, expect, it, vi } from "vitest";
import { researchTopic, toSentences } from "@/lib/content/research";
import { writeOfflineDeck } from "@/lib/content/offline";
import { getPreset } from "@/lib/presets";
import { plain } from "@/lib/render/text";
import { MAX_TITLE_WORDS, wordCount } from "@/lib/content/schema";

/** A fetch stub that answers the two Wikipedia endpoints from a fixture. */
function stubFetch(fixture: {
  search: { key: string; title: string }[];
  summaries: Record<string, { title: string; extract: string; description?: string }>;
}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/search/page")) {
      return new Response(JSON.stringify({ pages: fixture.search }), { status: 200 });
    }
    const m = /page\/summary\/([^?]+)/.exec(u);
    if (m) {
      const key = decodeURIComponent(m[1]);
      const sum = fixture.summaries[key];
      if (!sum) return new Response("{}", { status: 404 });
      return new Response(
        JSON.stringify({
          title: sum.title,
          extract: sum.extract,
          description: sum.description,
          content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${key}` } },
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

const FIXTURE = {
  search: [
    { key: "Habit", title: "Habit" },
    { key: "Habit_formation", title: "Habit formation" },
  ],
  summaries: {
    Habit: {
      title: "Habit",
      description: "Routine of behavior repeated regularly",
      extract:
        "A habit is a routine of behavior that is repeated regularly and tends to occur subconsciously. The American Journal of Psychology defined a habit as a more or less fixed way of thinking. Habitual behavior often goes unnoticed by the person exhibiting it, because a person does not need to engage in self-analysis when undertaking routine tasks.",
    },
    Habit_formation: {
      title: "Habit formation",
      description: "Process by which behaviors become automatic",
      extract:
        "Habit formation is the process by which a behavior, through regular repetition, becomes automatic or habitual. This is modelled as an increase in automaticity with the number of repetitions up to an asymptote. On average it takes more than two months before a new behavior becomes automatic.",
    },
  },
};

describe("toSentences", () => {
  it("splits into clean, slide-length sentences", () => {
    const s = toSentences(FIXTURE.summaries.Habit.extract);
    expect(s.length).toBeGreaterThan(1);
    for (const sentence of s) {
      expect(sentence.length).toBeGreaterThanOrEqual(30);
      expect(sentence.length).toBeLessThanOrEqual(220);
    }
  });

  it("does not split on common abbreviations", () => {
    const s = toSentences("Use tools e.g. a timer and a notebook to build the habit properly today.");
    expect(s).toHaveLength(1);
  });

  it("returns nothing for empty or junk input", () => {
    expect(toSentences("")).toEqual([]);
    expect(toSentences("short.")).toEqual([]);
  });
});

describe("researchTopic", () => {
  it("returns real facts and attributed sources from the fixture", async () => {
    const r = await researchTopic("habit", { fetchImpl: stubFetch(FIXTURE) });
    expect(r.sources).toHaveLength(2);
    expect(r.sources[0]).toEqual({ title: "Habit", url: "https://en.wikipedia.org/wiki/Habit" });
    expect(r.facts.length).toBeGreaterThan(2);
    expect(r.lead).toContain("habit");
    expect(r.descriptions.length).toBeGreaterThan(0);
  });

  it("de-duplicates facts across articles", async () => {
    const dupFixture = {
      search: [
        { key: "A", title: "A" },
        { key: "B", title: "B" },
      ],
      summaries: {
        A: { title: "A", extract: FIXTURE.summaries.Habit.extract },
        B: { title: "B", extract: FIXTURE.summaries.Habit.extract },
      },
    };
    const r = await researchTopic("x", { fetchImpl: stubFetch(dupFixture) });
    const keys = r.facts.map((f) => f.toLowerCase().slice(0, 40));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("fails soft on a network error", async () => {
    const boom = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const r = await researchTopic("anything", { fetchImpl: boom });
    expect(r).toEqual({ lead: "", facts: [], sources: [], descriptions: [] });
  });

  it("fails soft when search returns nothing", async () => {
    const empty = stubFetch({ search: [], summaries: {} });
    const r = await researchTopic("nothing matches", { fetchImpl: empty });
    expect(r.facts).toEqual([]);
    expect(r.sources).toEqual([]);
  });

  it("returns empty for a blank topic without calling the network", async () => {
    const spy = vi.fn();
    await researchTopic("   ", { fetchImpl: spy as unknown as typeof fetch });
    expect(spy).not.toHaveBeenCalled();
  });

  it("keeps a namesake's biography from leaking into an on-topic deck", async () => {
    // Wikipedia returns the telescope AND the person it is named after. The
    // person's facts ("He also dealt with the Apollo 1 fire") are off-topic and
    // pronoun-led — they must not appear as slide facts.
    const fixture = {
      search: [
        { key: "James_Webb_Space_Telescope", title: "James Webb Space Telescope" },
        { key: "James_E._Webb", title: "James E. Webb" },
      ],
      summaries: {
        James_Webb_Space_Telescope: {
          title: "James Webb Space Telescope",
          extract:
            "The James Webb Space Telescope is a space telescope designed to conduct infrared astronomy. It is the largest optical telescope in space, and its high resolution lets it view objects too old and distant for the Hubble Space Telescope.",
        },
        "James_E._Webb": {
          title: "James E. Webb",
          extract:
            "James Edwin Webb was an American government official who served as the second administrator of NASA. He also dealt with the Apollo 1 fire and its aftermath. He helped found the National Academy of Public Administration in his later career.",
        },
      },
    };
    const r = await researchTopic("James Webb Space Telescope", { fetchImpl: stubFetch(fixture) });
    const joined = r.facts.join(" ");
    expect(joined).not.toMatch(/Apollo 1 fire/);
    expect(joined).not.toMatch(/National Academy of Public Administration/);
    expect(joined).toMatch(/infrared astronomy|largest optical telescope/);
    // The biography contributed no usable fact, so it should not be cited.
    expect(r.sources.map((s) => s.title)).not.toContain("James E. Webb");
  });
});

describe("offline writer with research", () => {
  it("leads body slides with real facts and attaches sources", async () => {
    const research = await researchTopic("habit", { fetchImpl: stubFetch(FIXTURE) });
    const deck = writeOfflineDeck({
      topic: "How habits form",
      handle: "@x",
      preset: getPreset("keynote"),
      slideCount: 6,
      research,
    });
    expect(deck.enriched).toBe(true);
    expect(deck.sources.length).toBe(2);
    expect(deck.caption).toMatch(/public sources/i);
    // At least one body slide should carry researched wording, not a template line.
    const bodyTitles = deck.slides.filter((s) => s.role === "body").map((s) => plain(s.title));
    expect(bodyTitles.some((t) => /habit|behavior|repetition|automatic/i.test(t))).toBe(true);
    for (const s of deck.slides) expect(wordCount(s.title)).toBeLessThanOrEqual(MAX_TITLE_WORDS);
  });

  it("falls back to placeholders when research is thin", () => {
    const deck = writeOfflineDeck({
      topic: "Obscure topic",
      preset: getPreset("keynote"),
      slideCount: 8,
      research: { lead: "", facts: ["one only"], sources: [], descriptions: [] },
    });
    expect(deck.enriched).toBe(false);
    expect(deck.caption).toMatch(/draft skeleton/i);
  });

  it("still works with no research at all (unchanged free skeleton)", () => {
    const deck = writeOfflineDeck({ topic: "Anything", preset: getPreset("keynote"), slideCount: 7 });
    expect(deck.enriched).toBe(false);
    expect(deck.offline).toBe(true);
    expect(deck.slides).toHaveLength(7);
  });
});
