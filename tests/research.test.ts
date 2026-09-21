import { describe, expect, it, vi } from "vitest";
import { researchTopic, toSentences, searchQuery } from "@/lib/content/research";
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

describe("searchQuery", () => {
  it("keeps the subject and drops how-to scaffolding and bare years", () => {
    const q = searchQuery("How to grow an audience on LinkedIn in 2026").toLowerCase();
    expect(q).toContain("grow");
    expect(q).toContain("audience");
    expect(q).toContain("linkedin");
    expect(q).not.toContain("2026");
    expect(q).not.toMatch(/\bhow\b/);
  });

  it("drops generic list words but keeps the real topic", () => {
    const q = searchQuery("5 common myths about intermittent fasting").toLowerCase();
    expect(q).toContain("intermittent");
    expect(q).toContain("fasting");
    expect(q).not.toContain("myths");
    expect(q).not.toContain("common");
  });

  it("leaves a plain subject untouched and falls back safely", () => {
    expect(searchQuery("Photosynthesis")).toBe("Photosynthesis");
    expect(searchQuery("how to")).toBe("how to"); // nothing significant left → fallback
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

  it("maps each fact to the source it was drawn from", async () => {
    const r = await researchTopic("habit", { fetchImpl: stubFetch(FIXTURE) });
    expect(r.factSources).toHaveLength(r.facts.length);
    for (const idx of r.factSources ?? []) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(r.sources.length);
    }
    // At least one fact comes from the primary article (source 0).
    expect(r.factSources).toContain(0);
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
    expect(r).toEqual({ lead: "", facts: [], factSources: [], sources: [], descriptions: [] });
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

  it("discards a whiffed search whose top hit is unrelated (how-to topic)", async () => {
    // "How to clean white sneakers" has no Wikipedia article, so search returns
    // an unrelated person as the top hit. It must not poison the deck: no lead,
    // no facts, no citation — the writer falls back to an honest draft.
    const fixture = {
      search: [{ key: "Donald_Trump", title: "Donald Trump" }],
      summaries: {
        Donald_Trump: {
          title: "Donald Trump",
          description: "President of the United States",
          extract:
            "Donald John Trump is an American politician, media personality, and businessman who is the 47th president of the United States. A member of the Republican Party, he served as the 45th president from 2017 to 2021.",
        },
      },
    };
    const r = await researchTopic("How to clean white sneakers without ruining them", { fetchImpl: stubFetch(fixture) });
    expect(r.lead).toBe("");
    expect(r.facts).toEqual([]);
    expect(r.sources).toEqual([]);
    expect(r.facts.join(" ")).not.toMatch(/Trump|president/i);
  });

  it("still trusts a relevant top hit fully", async () => {
    // Sanity: the guard must not over-fire. A genuine match keeps its facts.
    const r = await researchTopic("habit", { fetchImpl: stubFetch(FIXTURE) });
    expect(r.lead).toContain("habit");
    expect(r.facts.length).toBeGreaterThan(2);
  });

  it("rejects an article that shares only a generic word, not the subject", async () => {
    // "acute intermittent porphyria" shares "intermittent" with "intermittent
    // fasting" but not the subject ("fasting"). It must not qualify.
    const fixture = {
      search: [{ key: "Porphyria", title: "Porphyria" }],
      summaries: {
        Porphyria: {
          title: "Porphyria",
          description: "Group of liver disorders",
          extract:
            "Porphyria is a group of disorders in which substances called porphyrins build up. The acute intermittent type affects the nervous system. Symptoms of an attack include abdominal pain and vomiting that lasts days.",
        },
      },
    };
    const r = await researchTopic("Common myths about intermittent fasting", { fetchImpl: stubFetch(fixture) });
    expect(r.facts).toEqual([]);
    expect(r.lead).toBe("");
    expect(r.facts.join(" ")).not.toMatch(/porphyria/i);
  });

  it("accepts an article that matches the subject noun", async () => {
    const fixture = {
      search: [{ key: "Intermittent_fasting", title: "Intermittent fasting" }],
      summaries: {
        Intermittent_fasting: {
          title: "Intermittent fasting",
          description: "Eating pattern that cycles between fasting and eating",
          extract:
            "Intermittent fasting is any of various meal timing schedules that cycle between fasting and eating. Studies suggest intermittent fasting can support weight management for some people. It is not recommended for everyone, including those with a history of disordered eating.",
        },
      },
    };
    const r = await researchTopic("Common myths about intermittent fasting", { fetchImpl: stubFetch(fixture) });
    expect(r.facts.length).toBeGreaterThan(0);
    expect(r.facts.join(" ").toLowerCase()).toMatch(/fasting/);
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

  it("never puts a generic scaffolding body under a real fact title", () => {
    // Exactly bodyCount facts: enough to lead every body slide's title, but
    // none left for bodies. Bodies must be empty, not the off-topic FRAMES copy.
    const facts = [
      "Photosynthesis converts light energy into chemical energy in plants.",
      "The process releases oxygen as a byproduct into the atmosphere.",
      "Chlorophyll in the chloroplasts absorbs mostly red and blue light.",
      "Most life on Earth depends on photosynthesis for food and oxygen.",
    ];
    const deck = writeOfflineDeck({
      topic: "Photosynthesis",
      preset: getPreset("keynote"),
      slideCount: 6, // bodyCount = 4, matches facts.length
      research: { lead: "Photosynthesis feeds most life on Earth.", facts, sources: [{ title: "Photosynthesis", url: "https://en.wikipedia.org/wiki/Photosynthesis" }], descriptions: [] },
    });
    expect(deck.enriched).toBe(true);
    const bodyText = deck.slides.filter((s) => s.role === "body").map((s) => (s.body ? plain(s.body) : ""));
    for (const b of bodyText) {
      expect(b).not.toMatch(/outcome that matters|Small, scheduled|optimises for effort|Before anything else/i);
      // Any body that IS present must be one of the real facts, never a template.
      if (b) expect(facts.some((f) => f.startsWith(b.replace(/…$/, "").trim().slice(0, 20)))).toBe(true);
    }
  });

  it("stays enriched with a few facts instead of reverting the whole deck", () => {
    // 3 real facts on an 8-slide deck (bodyCount 6). Old behaviour needed 6 and
    // dropped everything to skeleton; now it enriches and degrades leftover
    // slides to topic-anchored frames.
    const facts = [
      "The James Webb Space Telescope conducts infrared astronomy from space.",
      "It is the largest optical telescope ever launched into space.",
      "Its sunshield keeps the instruments cold enough to see faint heat.",
    ];
    const deck = writeOfflineDeck({
      topic: "James Webb Space Telescope",
      preset: getPreset("keynote"),
      slideCount: 8,
      research: { lead: "A giant infrared eye in space.", facts, sources: [{ title: "James Webb Space Telescope", url: "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope" }], descriptions: [] },
    });
    expect(deck.enriched).toBe(true);
    expect(deck.caption).toMatch(/public sources/i);
    const bodyTitles = deck.slides.filter((s) => s.role === "body").map((s) => plain(s.title));
    // The first three body slides carry the real facts.
    expect(bodyTitles.some((t) => /infrared astronomy/i.test(t))).toBe(true);
    expect(bodyTitles.some((t) => /largest optical telescope/i.test(t))).toBe(true);
  });

  it("credits each enriched slide with the exact source its fact came from", () => {
    const research = {
      lead: "An overview of panels and cells.",
      facts: ["Solar panels convert sunlight into usable electricity.", "Photovoltaic cells rely on the semiconductor junction."],
      factSources: [0, 1],
      sources: [
        { title: "Solar panel", url: "https://en.wikipedia.org/wiki/Solar_panel" },
        { title: "Photovoltaics", url: "https://en.wikipedia.org/wiki/Photovoltaics" },
      ],
      descriptions: [],
    };
    const deck = writeOfflineDeck({ topic: "Solar panels", preset: getPreset("keynote"), slideCount: 4, research });
    expect(deck.enriched).toBe(true);
    const notes = deck.slides.filter((s) => s.role === "body").map((s) => s.note ?? "");
    expect(notes.some((n) => /Source: Solar panel/.test(n))).toBe(true);
    expect(notes.some((n) => /Source: Photovoltaics/.test(n))).toBe(true);
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
