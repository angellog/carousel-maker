import { describe, expect, it } from "vitest";
import {
  TONES,
  detectFormat,
  directDeck,
  type ArtDirection,
} from "@/lib/director";
import { PRESET_BY_ID } from "@/lib/presets";
import { PALETTE_BY_ID } from "@/lib/theme";

/** Assert an ArtDirection only ever names real, in-range things. */
function expectValid(d: ArtDirection) {
  const preset = PRESET_BY_ID.get(d.presetId);
  expect(preset, `preset ${d.presetId} must exist`).toBeDefined();
  expect(PALETTE_BY_ID.has(d.paletteId), `palette ${d.paletteId} must exist`).toBe(true);
  const [lo, hi] = preset!.slideRange;
  expect(d.slideCount).toBeGreaterThanOrEqual(lo);
  expect(d.slideCount).toBeLessThanOrEqual(hi);
  expect(Number.isInteger(d.slideCount)).toBe(true);
  expect(TONES).toContain(d.tone);
  expect(["straight", "mentor", "contrarian", "analyst", "hype"]).toContain(d.voiceId);
  expect(d.reasons.length).toBeGreaterThanOrEqual(2);
  expect(d.reasons.length).toBeLessThanOrEqual(4);
  for (const r of d.reasons) {
    expect(r.length).toBeGreaterThan(0);
    expect(r, "reasons must not use em dashes").not.toContain("—");
  }
}

describe("detectFormat", () => {
  it("classifies a versus topic as a comparison", () => {
    expect(detectFormat("React vs Vue in 2026")).toBe("comparison");
    expect(detectFormat("Notion or Obsidian for notes")).toBe("comparison");
  });

  it("does not let 'orchestra' trigger the 'or' comparison rule", () => {
    // No comparison signal here, so it should fall through, never "comparison".
    expect(detectFormat("A short history of the orchestra")).not.toBe("comparison");
  });

  it("classifies a how-to topic", () => {
    expect(detectFormat("How to start running")).toBe("how-to");
    expect(detectFormat("A beginner guide to sourdough")).toBe("how-to");
  });

  it("classifies a numbered listicle", () => {
    expect(detectFormat("7 mistakes new managers make")).toBe("list");
    expect(detectFormat("Top 10 productivity apps")).toBe("list");
  });

  it("classifies a data topic", () => {
    expect(detectFormat("The state of AI in 2026 (stats)")).toBe("data");
    expect(detectFormat("SaaS churn benchmarks")).toBe("data");
  });

  it("classifies a myth-bust topic", () => {
    expect(detectFormat("5 myths about sleep")).toBe("myth-bust");
    expect(detectFormat("The truth about intermittent fasting")).toBe("myth-bust");
  });

  it("classifies a story topic", () => {
    expect(detectFormat("How I built my newsletter to 10k")).toBe("story");
  });

  it("classifies a quote topic", () => {
    expect(detectFormat("Quotes on discipline")).toBe("quote");
  });

  it("defaults an unclassifiable topic to deep-dive", () => {
    expect(detectFormat("The photosynthesis process")).toBe("deep-dive");
  });

  it("is case-insensitive", () => {
    expect(detectFormat("HOW TO SHIP FASTER")).toBe("how-to");
  });
});

describe("directDeck template selection", () => {
  it("routes a comparison topic to the Versus template", () => {
    const d = directDeck({ topic: "Figma vs Sketch for product design" });
    expect(d.presetId).toBe("versus");
    expect(d.format).toBe("comparison");
    expectValid(d);
  });

  it("routes a listicle to the Memo template", () => {
    const d = directDeck({ topic: "7 mistakes new managers make" });
    expect(d.presetId).toBe("memo");
    expect(d.format).toBe("list");
    expectValid(d);
  });

  it("routes a how-to topic to the Roadmap template", () => {
    const d = directDeck({ topic: "How to start running" });
    expect(d.presetId).toBe("roadmap");
    expect(d.format).toBe("how-to");
    expectValid(d);
  });

  it("routes a stats topic to a data template", () => {
    const d = directDeck({ topic: "The state of AI in 2026 (stats)" });
    expect(["ledger", "swiss"]).toContain(d.presetId);
    expect(d.format).toBe("data");
    expectValid(d);
  });

  it("routes a myth topic to the Manifesto template", () => {
    const d = directDeck({ topic: "5 myths about sleep you still believe" });
    expect(d.presetId).toBe("manifesto");
    expect(d.format).toBe("myth-bust");
    expectValid(d);
  });

  it("routes a personal story to the Serif Zine template", () => {
    const d = directDeck({ topic: "How I quit my job and went indie" });
    expect(d.presetId).toBe("serifzine");
    expect(d.format).toBe("story");
    expectValid(d);
  });

  it("routes a reference list to the Spec template", () => {
    const d = directDeck({ topic: "20 git commands cheat sheet" });
    expect(d.presetId).toBe("spec");
    expectValid(d);
  });

  it("routes a money/business playbook to the Teardown template", () => {
    const d = directDeck({ topic: "How I built a $10k/month AI agency from scratch" });
    expect(d.presetId).toBe("teardown");
    expectValid(d);
  });

  it("routes an overview to the Roadmap template", () => {
    const d = directDeck({ topic: "Course overview: what to expect" });
    expect(d.presetId).toBe("roadmap");
    expectValid(d);
  });

  it("routes a playful topic to Arcade with a hype voice", () => {
    const d = directDeck({ topic: "Fun pop culture trivia quiz" });
    expect(d.presetId).toBe("arcade");
    expect(d.voiceId).toBe("hype");
    expect(d.tone).toBe("Playful");
    expectValid(d);
  });
});

describe("directDeck voice and palette", () => {
  it("gives comparison and myth topics a contrarian voice", () => {
    expect(directDeck({ topic: "Rest vs Grind for productivity" }).voiceId).toBe("contrarian");
    expect(directDeck({ topic: "Myths about passive income" }).voiceId).toBe("contrarian");
  });

  it("gives data and deep-dive topics an analyst voice", () => {
    expect(directDeck({ topic: "Startup fundraising benchmarks" }).voiceId).toBe("analyst");
    expect(directDeck({ topic: "Understanding how transformers work" }).voiceId).toBe("analyst");
  });

  it("leans the palette toward the domain when the preset allows it", () => {
    // AI is a tech topic; ledger offers blueprint, which is a tech lean.
    const d = directDeck({ topic: "The state of AI in 2026 (stats)" });
    expect(d.paletteId).toBe("blueprint");
  });

  it("only ever chooses palettes the chosen preset was designed against", () => {
    const topics = [
      "React vs Vue",
      "How to bake bread",
      "7 tips for founders",
      "Crypto market data 2026",
      "Myths about dieting",
      "How I grew my audience",
      "Quotes on leadership",
      "Understanding quantum computing",
      "Fun trivia about space",
    ];
    for (const topic of topics) {
      const d = directDeck({ topic });
      const preset = PRESET_BY_ID.get(d.presetId)!;
      expect(preset.palettes, `${topic} → ${d.presetId}/${d.paletteId}`).toContain(d.paletteId);
    }
  });
});

describe("directDeck slide count", () => {
  it("respects an in-range hint", () => {
    // compare range is [7, 9].
    const d = directDeck({ topic: "React vs Vue", slideCount: 8 });
    expect(d.slideCount).toBe(8);
  });

  it("clamps an over-range hint down to the preset maximum", () => {
    const d = directDeck({ topic: "React vs Vue", slideCount: 40 });
    const [, hi] = PRESET_BY_ID.get(d.presetId)!.slideRange;
    expect(d.slideCount).toBe(hi);
    expect(d.reasons.length).toBe(4);
  });

  it("clamps an under-range hint up to the preset minimum", () => {
    const d = directDeck({ topic: "React vs Vue", slideCount: 1 });
    const [lo] = PRESET_BY_ID.get(d.presetId)!.slideRange;
    expect(d.slideCount).toBe(lo);
  });

  it("derives a sensible count when no hint is given", () => {
    const d = directDeck({ topic: "How to start running" });
    const [lo, hi] = PRESET_BY_ID.get(d.presetId)!.slideRange;
    expect(d.slideCount).toBeGreaterThanOrEqual(lo);
    expect(d.slideCount).toBeLessThanOrEqual(hi);
  });
});

describe("directDeck robustness", () => {
  it("is deterministic: same input, deep-equal output", () => {
    const input = { topic: "React vs Vue in 2026", audience: "devs", slideCount: 8 };
    expect(directDeck(input)).toEqual(directDeck(input));
  });

  it("returns a valid safe fallback for an empty topic", () => {
    const d = directDeck({ topic: "" });
    expect(d.presetId).toBe("manifesto");
    expect(d.reasons[0].toLowerCase()).toContain("no readable topic");
    expectValid(d);
  });

  it("returns a valid safe fallback for garbage input", () => {
    const d = directDeck({ topic: "!!!   ??? ***" });
    expect(d.presetId).toBe("manifesto");
    expectValid(d);
  });

  it("always returns a valid direction across a spread of topics", () => {
    const topics = [
      "",
      "   ",
      "x",
      "React vs Vue",
      "How to meditate daily",
      "10 books that changed my life",
      "Ecommerce conversion data",
      "Debunking startup myths",
      "How I learned to code",
      "Quotes on resilience",
      "The science of habit formation",
      "Overview of the design system",
      "Fun memes about developers",
      "Launch sale: 50% off everything",
    ];
    for (const topic of topics) {
      expectValid(directDeck({ topic }));
    }
  });

  it("uses source material as an extra signal", () => {
    const d = directDeck({
      topic: "My take",
      material: "This compares approach A versus approach B in detail.",
    });
    expect(d.format).toBe("comparison");
    expectValid(d);
  });
});
