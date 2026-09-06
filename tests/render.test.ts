import { Canvas, createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { beforeAll, describe, expect, it } from "vitest";
import { writeOfflineDeck } from "@/lib/content/offline";
import { PRESETS, getPreset } from "@/lib/presets";
import { makeCtx } from "@/lib/render/ctx";
import { renderScene, setCanvasFactory } from "@/lib/render/paint";
import { createMeasurer } from "@/lib/render/text";
import { FONT_FALLBACKS, getPalette, type FontSet } from "@/lib/theme";
import type { Deck } from "@/lib/types";

/**
 * End-to-end paint tests against a real Canvas2D implementation. These cover
 * the code path the PNG export actually uses — the browser preview and the
 * downloaded file come from the same renderScene call.
 */

type AnyCanvas = Canvas;
const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;

let measurer: ReturnType<typeof createMeasurer>;
const fonts = { ...FONT_FALLBACKS } as FontSet;

beforeAll(() => {
  // The painter builds Path2D objects; Node has no global for them.
  (globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
  setCanvasFactory(make);
  measurer = createMeasurer(make);
});

function paint(deck: Deck, presetId: string, index: number, scale = 0.5): AnyCanvas {
  const preset = getPreset(presetId);
  const ctx = makeCtx({
    deck,
    slide: deck.slides[index],
    index,
    total: deck.slides.length,
    pal: getPalette(undefined, preset.defaultPalette),
    fonts,
    m: measurer,
    pad: preset.pad,
  });
  const canvas: Canvas = createCanvas(10, 10);
  renderScene(canvas as unknown as HTMLCanvasElement, preset.render(ctx), measurer, scale);
  return canvas;
}

interface Stats {
  /** Fraction of pixels differing from the top-left corner colour. */
  ink: number;
  /** Distinct quantised colours — a solid fill scores 1. */
  colours: number;
  /** Luminance spread, 0–255. Text on a ground pushes this up. */
  range: number;
}

function stats(canvas: AnyCanvas): Stats {
  const ctx = canvas.getContext("2d");
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const [r0, g0, b0] = [data[0], data[1], data[2]];
  const seen = new Set<number>();
  let diff = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0) > 24) diff++;
    seen.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  return { ink: diff / (width * height), colours: seen.size, range: max - min };
}

const deckFor = (id: string) =>
  writeOfflineDeck({
    topic: "Why most morning routines fall apart by week three",
    audience: "people who keep restarting",
    handle: "@carouselmaker",
    preset: getPreset(id),
    slideCount: 9,
  });

describe("canvas painting", () => {
  it("sizes the bitmap from the scene and the scale factor", () => {
    const c = paint(deckFor("keynote"), "keynote", 0, 1);
    expect(c.width).toBe(1080);
    expect(c.height).toBe(1350);
    const c2 = paint(deckFor("keynote"), "keynote", 0, 2);
    expect(c2.width).toBe(2160);
    expect(c2.height).toBe(2700);
  });

  it("produces a real PNG buffer at export resolution", () => {
    const c = paint(deckFor("keynote"), "keynote", 1, 2);
    const png = c.toBuffer("image/png");
    expect(png.length).toBeGreaterThan(5000);
    // PNG magic number.
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it.each(PRESETS.map((p) => [p.id] as const))("%s paints legible content on every slide", (id) => {
    const deck = deckFor(id);
    for (let i = 0; i < deck.slides.length; i++) {
      const { ink, colours, range } = stats(paint(deck, id, i));
      expect(ink, `${id} slide ${i} is blank`).toBeGreaterThan(0.004);
      expect(colours, `${id} slide ${i} is a flat fill`).toBeGreaterThan(24);
      // Type has to actually contrast against its ground to be readable.
      expect(range, `${id} slide ${i} has no contrast`).toBeGreaterThan(70);
    }
  });

  it("renders identically for the same input (no time or Math.random)", () => {
    const deck = deckFor("chalkboard");
    const a = paint(deck, "chalkboard", 2).toBuffer("image/png");
    const b = paint(deck, "chalkboard", 2).toBuffer("image/png");
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it("never throws on a deck whose optional fields are all missing", () => {
    for (const p of PRESETS) {
      const deck = deckFor(p.id);
      const bare: Deck = {
        ...deck,
        handle: "",
        caption: "",
        hashtags: [],
        slides: deck.slides.map((s, i) => ({ id: s.id, role: s.role, title: `S${i}` })),
      };
      expect(() => paint(bare, p.id, 1, 0.3), p.id).not.toThrow();
    }
  });
});
