import { describe, expect, it } from "vitest";
import { BLUEPRINTS, blueprintFor, blueprintSection } from "@/lib/content/blueprints";
import { buildSystemPrompt } from "@/lib/content/prompt";
import { getPreset } from "@/lib/presets";
import type { DeckFormat } from "@/lib/director";

const FORMATS: DeckFormat[] = ["list", "how-to", "comparison", "data", "myth-bust", "story", "quote", "deep-dive"];

describe("deck blueprints (extracted famous-ig editorial method)", () => {
  it("ships a well-formed blueprint for every Art Director format", () => {
    for (const f of FORMATS) {
      const b = BLUEPRINTS[f];
      expect(b).toBeTruthy();
      expect(b.id).toBe(f);
      expect(b.name).toBeTruthy();
      expect(b.note).toBeTruthy();
      expect(b.arc.length).toBeGreaterThanOrEqual(3);
      b.arc.forEach((beat) => expect(beat.length).toBeGreaterThan(8));
    }
  });

  it("blueprintFor is total and falls back safely", () => {
    for (const f of FORMATS) expect(blueprintFor(f).id).toBe(f);
    // @ts-expect-error — exercising the runtime fallback for an unknown format.
    expect(blueprintFor("nonsense").id).toBe("list");
  });

  it("the prompt section carries the no-filler discipline and the arc", () => {
    const s = blueprintSection("how-to", 8);
    expect(s).toContain("How-to spine");
    expect(s.toLowerCase()).toContain("no filler");
    expect(s.toLowerCase()).toContain("hook");
    expect(s).toContain("8 slides");
    // Every beat of the arc appears.
    for (const beat of BLUEPRINTS["how-to"].arc) expect(s).toContain(beat);
  });
});

describe("blueprint wired into the writer prompt", () => {
  it("derives the arc from the topic and splices it in", () => {
    const preset = getPreset("timeline");
    const howto = buildSystemPrompt(preset, { topic: "How to clean white sneakers", slideCount: 8, presetId: "timeline", research: false });
    expect(howto).toContain("How-to spine");

    const versus = buildSystemPrompt(getPreset("compare"), { topic: "iPhone vs Android for creators", slideCount: 6, presetId: "compare", research: false });
    expect(versus).toContain("Versus spine");

    const myth = buildSystemPrompt(getPreset("keynote"), { topic: "Common myths about intermittent fasting", slideCount: 7, presetId: "keynote", research: false });
    expect(myth).toContain("Myth spine");
  });

  it("keeps the non-negotiable rules alongside the arc", () => {
    const p = buildSystemPrompt(getPreset("numberlist"), { topic: "5 budgeting tips", slideCount: 7, presetId: "numberlist", research: false });
    expect(p).toContain("One idea per slide");
    expect(p).toContain("Deck arc");
    expect(p).toContain("No em dashes"); // caption discipline
  });
});
