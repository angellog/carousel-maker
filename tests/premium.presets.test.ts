import { describe, expect, it } from "vitest";
import { PREMIUM_PRESETS } from "@/lib/presets/premium";
import { CANVAS_H, CANVAS_W, makeCtx } from "@/lib/render/ctx";
import { metricMeasurer } from "@/lib/render/text";
import type { Node, Scene } from "@/lib/render/scene";
import { FONT_FALLBACKS, getPalette, type FontSet } from "@/lib/theme";
import { writeOfflineDeck } from "@/lib/content/offline";
import type { Deck } from "@/lib/types";
import type { Preset } from "@/lib/presets/types";

const fonts = { ...FONT_FALLBACKS } as FontSet;

function build(deck: Deck, preset: Preset, index: number, paletteId?: string): Scene {
  const ctx = makeCtx({
    deck,
    slide: deck.slides[index],
    index,
    total: deck.slides.length,
    pal: getPalette(paletteId, preset.defaultPalette),
    fonts,
    m: metricMeasurer,
    pad: preset.pad,
  });
  return preset.render(ctx);
}

/** Walk every numeric field of a scene looking for NaN/Infinity. */
function badNumbers(scene: Scene): string[] {
  const bad: string[] = [];
  const check = (v: unknown, path: string) => {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) bad.push(`${path}=${v}`);
      return;
    }
    if (typeof v === "string") {
      if (/NaN|Infinity/.test(v)) bad.push(`${path}="${v}"`);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => check(x, `${path}[${i}]`));
      return;
    }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v)) check(val, `${path}.${k}`);
    }
  };
  scene.nodes.forEach((n, i) => check(n, `node[${i}]:${(n as Node).kind}`));
  check(scene.bg, "bg");
  return bad;
}

function textNodes(scene: Scene): Extract<Node, { kind: "text" }>[] {
  const out: Extract<Node, { kind: "text" }>[] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.kind === "text") out.push(n);
      else if (n.kind === "group") walk(n.children);
    }
  };
  walk(scene.nodes);
  return out;
}

function deckFor(preset: Preset): Deck {
  return writeOfflineDeck({
    topic: "The quiet habits behind consistent writing",
    handle: "@writer",
    preset,
    slideCount: 9,
  });
}

describe("premium preset registry", () => {
  it("exports exactly four premium presets with unique ids", () => {
    expect(PREMIUM_PRESETS).toHaveLength(4);
    expect(new Set(PREMIUM_PRESETS.map((p) => p.id)).size).toBe(4);
  });

  it("declares real palettes (including its default) and a usable brief", () => {
    for (const p of PREMIUM_PRESETS) {
      expect(p.palettes.length, p.id).toBeGreaterThan(0);
      expect(p.palettes, p.id).toContain(p.defaultPalette);
      for (const id of p.palettes) expect(getPalette(id, p.defaultPalette).id, `${p.id} → ${id}`).toBe(id);
      expect(p.blurb.length, p.id).toBeGreaterThan(10);
      expect(p.brief.length, p.id).toBeGreaterThan(60);
      const [lo, hi] = p.slideRange;
      expect(lo, p.id).toBeGreaterThanOrEqual(3);
      expect(hi, p.id).toBeGreaterThanOrEqual(lo);
      expect(hi, p.id).toBeLessThanOrEqual(12);
    }
  });
});

describe.each(PREMIUM_PRESETS.map((p) => [p.id, p] as const))("premium preset %s", (_id, preset) => {
  const deck = deckFor(preset);

  it("renders every slide to a 1080x1350 scene with nodes and legible on-canvas text", () => {
    for (let i = 0; i < deck.slides.length; i++) {
      const scene = build(deck, preset, i);
      expect(scene.w).toBe(CANVAS_W);
      expect(scene.h).toBe(CANVAS_H);
      expect(scene.nodes.length, `slide ${i} produced no nodes`).toBeGreaterThan(0);
      expect(badNumbers(scene), `slide ${i}`).toEqual([]);
      for (const t of textNodes(scene)) {
        expect(t.size, `slide ${i} font size`).toBeGreaterThan(8);
        expect(t.lines.length, `slide ${i} empty text node`).toBeGreaterThan(0);
        expect(t.y, `slide ${i} text above canvas`).toBeGreaterThan(-CANVAS_H);
        expect(t.y, `slide ${i} text below canvas`).toBeLessThan(CANVAS_H + 40);
      }
    }
  });

  it("renders cleanly through every palette it offers", () => {
    for (const paletteId of preset.palettes) {
      const scene = build(deck, preset, 1, paletteId);
      expect(scene.nodes.length, `${preset.id}/${paletteId}`).toBeGreaterThan(0);
      expect(badNumbers(scene), `${preset.id}/${paletteId}`).toEqual([]);
      for (const t of textNodes(scene)) expect(t.size, `${preset.id}/${paletteId}`).toBeGreaterThan(8);
    }
  });

  it("survives a title-only bare deck (every optional field missing)", () => {
    const bare: Deck = {
      ...deck,
      slides: deck.slides.map((s, i) => ({ id: s.id, role: s.role, title: `Slide ${i + 1}` })),
    };
    for (let i = 0; i < bare.slides.length; i++) {
      const scene = build(bare, preset, i);
      expect(scene.nodes.length, `slide ${i}`).toBeGreaterThan(0);
      expect(badNumbers(scene), `slide ${i}`).toEqual([]);
    }
  });

  it("survives a 60-word stress deck and 1-char copy without breaking", () => {
    const long = "word ".repeat(60).trim();
    const stress: Deck = {
      ...deck,
      handle: "",
      slides: deck.slides.map((s) => ({
        ...s,
        title: long,
        body: long,
        kicker: long,
        note: long,
        bullets: [long, long, long, long, long],
      })),
    };
    for (let i = 0; i < stress.slides.length; i++) {
      const scene = build(stress, preset, i);
      expect(badNumbers(scene), `long slide ${i}`).toEqual([]);
      for (const t of textNodes(scene)) {
        expect(t.size, `long slide ${i} size`).toBeGreaterThan(8);
        expect(t.y, `long slide ${i} above canvas`).toBeGreaterThan(-CANVAS_H);
        expect(t.y, `long slide ${i} below canvas`).toBeLessThan(CANVAS_H + 40);
      }
    }
    const tiny: Deck = {
      ...deck,
      slides: deck.slides.map((s) => ({ ...s, title: "A", body: "B", kicker: "C", note: "D", bullets: ["E"] })),
    };
    for (let i = 0; i < tiny.slides.length; i++) {
      expect(badNumbers(build(tiny, preset, i)), `short slide ${i}`).toEqual([]);
    }
  });

  it("handles a two-slide deck without dividing by zero", () => {
    const pair: Deck = { ...deck, slides: deck.slides.slice(0, 2) };
    for (let i = 0; i < 2; i++) {
      expect(badNumbers(build(pair, preset, i)), `slide ${i}`).toEqual([]);
    }
  });
});
