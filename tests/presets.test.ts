import { describe, expect, it } from "vitest";
import { PRESETS, PRESET_BY_ID, getPreset } from "@/lib/presets";
import { ALL_FIELDS } from "@/lib/presets/_shared";
import { CANVAS_H, CANVAS_W, makeCtx } from "@/lib/render/ctx";
import { metricMeasurer } from "@/lib/render/text";
import type { Node, Scene } from "@/lib/render/scene";
import { FONT_FALLBACKS, PALETTE_BY_ID, getPalette, type FontSet } from "@/lib/theme";
import { writeOfflineDeck } from "@/lib/content/offline";
import type { Deck } from "@/lib/types";

const fonts = { ...FONT_FALLBACKS } as FontSet;

function build(deck: Deck, presetId: string, index: number, paletteId?: string): Scene {
  const preset = getPreset(presetId);
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

const decks = new Map<string, Deck>();
function deckFor(presetId: string): Deck {
  let d = decks.get(presetId);
  if (!d) {
    d = writeOfflineDeck({
      topic: "Why most morning routines fall apart by week three",
      audience: "people who keep restarting",
      handle: "@carouselmaker",
      preset: getPreset(presetId),
      slideCount: 9,
    });
    decks.set(presetId, d);
  }
  return d;
}

describe("preset registry", () => {
  it("ships exactly 12 curated presets", () => {
    expect(PRESETS).toHaveLength(12);
  });

  it("has unique ids", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(12);
    expect(PRESET_BY_ID.size).toBe(12);
  });

  it("declares only real palettes, including its default", () => {
    for (const p of PRESETS) {
      expect(p.palettes.length, p.id).toBeGreaterThan(0);
      expect(p.palettes, p.id).toContain(p.defaultPalette);
      for (const id of p.palettes) expect(PALETTE_BY_ID.has(id), `${p.id} → ${id}`).toBe(true);
    }
  });

  it("declares only real slide fields", () => {
    for (const p of PRESETS) {
      for (const f of p.needs) expect(ALL_FIELDS, `${p.id} → ${f}`).toContain(f);
    }
  });

  it("gives the writer a usable brief and a sane slide range", () => {
    for (const p of PRESETS) {
      expect(p.brief.length, p.id).toBeGreaterThan(60);
      expect(p.blurb.length, p.id).toBeGreaterThan(10);
      const [lo, hi] = p.slideRange;
      expect(lo, p.id).toBeGreaterThanOrEqual(3);
      expect(hi, p.id).toBeGreaterThanOrEqual(lo);
      expect(hi, p.id).toBeLessThanOrEqual(12);
    }
  });

  it("falls back to the first preset for an unknown id", () => {
    expect(getPreset("nope").id).toBe(PRESETS[0].id);
    expect(getPreset(undefined).id).toBe(PRESETS[0].id);
  });
});

describe.each(PRESETS.map((p) => [p.id, p.name] as const))("preset %s (%s)", (id) => {
  const deck = deckFor(id);

  it("renders every slide to a correctly sized scene with nodes", () => {
    for (let i = 0; i < deck.slides.length; i++) {
      const scene = build(deck, id, i);
      expect(scene.w).toBe(CANVAS_W);
      expect(scene.h).toBe(CANVAS_H);
      expect(scene.nodes.length, `slide ${i} produced no nodes`).toBeGreaterThan(0);
    }
  });

  it("never emits NaN or Infinity geometry", () => {
    for (let i = 0; i < deck.slides.length; i++) {
      expect(badNumbers(build(deck, id, i)), `slide ${i}`).toEqual([]);
    }
  });

  it("keeps text on the canvas and at a legible size", () => {
    for (let i = 0; i < deck.slides.length; i++) {
      const scene = build(deck, id, i);
      for (const t of textNodes(scene)) {
        expect(t.size, `slide ${i} font size`).toBeGreaterThan(8);
        expect(t.lines.length, `slide ${i} empty text node`).toBeGreaterThan(0);
        // Allow a little bleed for deliberately oversized ghost numerals.
        expect(t.y, `slide ${i} text above canvas`).toBeGreaterThan(-CANVAS_H);
        expect(t.y, `slide ${i} text below canvas`).toBeLessThan(CANVAS_H + 40);
      }
    }
  });

  it("renders through every palette it offers", () => {
    const preset = getPreset(id);
    for (const paletteId of preset.palettes) {
      const scene = build(deck, id, 1, paletteId);
      expect(scene.nodes.length).toBeGreaterThan(0);
      expect(badNumbers(scene), `${id}/${paletteId}`).toEqual([]);
    }
  });

  it("survives a deck with only titles (every optional field missing)", () => {
    const bare: Deck = {
      ...deck,
      slides: deck.slides.map((s, i) => ({ id: s.id, role: s.role, title: `Slide ${i + 1}` })),
    };
    for (let i = 0; i < bare.slides.length; i++) {
      const scene = build(bare, id, i);
      expect(scene.nodes.length, `slide ${i}`).toBeGreaterThan(0);
      expect(badNumbers(scene), `slide ${i}`).toEqual([]);
    }
  });

  it("survives absurdly long and absurdly short copy", () => {
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
      const scene = build(stress, id, i);
      expect(badNumbers(scene), `long slide ${i}`).toEqual([]);
      for (const t of textNodes(scene)) expect(t.size).toBeGreaterThan(8);
    }
    const tiny: Deck = {
      ...deck,
      slides: deck.slides.map((s) => ({ ...s, title: "A", body: "B", kicker: "C", note: "D", bullets: ["E"] })),
    };
    for (let i = 0; i < tiny.slides.length; i++) {
      expect(badNumbers(build(tiny, id, i)), `short slide ${i}`).toEqual([]);
    }
  });

  it("handles a two-slide deck without dividing by zero", () => {
    const pair: Deck = { ...deck, slides: deck.slides.slice(0, 2) };
    for (let i = 0; i < 2; i++) {
      expect(badNumbers(build(pair, id, i))).toEqual([]);
    }
  });
});
