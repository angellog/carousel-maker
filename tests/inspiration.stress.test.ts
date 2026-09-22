import { describe, expect, it } from "vitest";
import { buildInspiration, paletteFromExtracted } from "@/lib/inspiration";
import { PRESETS, getPreset } from "@/lib/presets";
import { makeCtx } from "@/lib/render/ctx";
import { metricMeasurer } from "@/lib/render/text";
import type { Node, Scene } from "@/lib/render/scene";
import { FONT_FALLBACKS, PALETTE_BY_ID, type FontSet } from "@/lib/theme";
import type { Palette } from "@/lib/types";
import { writeOfflineDeck } from "@/lib/content/offline";
import type { Deck } from "@/lib/types";

/**
 * Stress test for the "Match a look" fix. Because the fix makes derived palettes
 * actually apply, an arbitrary median-cut palette from ANY image can now reach
 * EVERY template (via the preview and the Style sheet). This fuzzes a wide set
 * of edge-case images into palettes and renders all 32 presets through each,
 * asserting nothing produces NaN geometry, empty text, or off-canvas text.
 */

const fonts = { ...FONT_FALLBACKS } as FontSet;

/* ----------------------------- synthetic images ---------------------------- */

type Img = { name: string; data: Uint8ClampedArray; w: number; h: number };

function buf(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fill(x, y);
      const p = (y * w + x) * 4;
      d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = a;
    }
  }
  return d;
}

// A small deterministic PRNG so the fuzz is reproducible.
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const IMAGES: Img[] = [
  { name: "all-black", w: 40, h: 50, data: buf(40, 50, () => [0, 0, 0, 255]) },
  { name: "all-white", w: 40, h: 50, data: buf(40, 50, () => [255, 255, 255, 255]) },
  { name: "mid-gray", w: 40, h: 50, data: buf(40, 50, () => [128, 128, 128, 255]) },
  { name: "near-black-lowcontrast", w: 40, h: 50, data: buf(40, 50, (x) => (x % 2 ? [10, 10, 12, 255] : [22, 20, 26, 255])) },
  { name: "near-white-lowcontrast", w: 40, h: 50, data: buf(40, 50, (x) => (x % 2 ? [245, 244, 240, 255] : [252, 251, 250, 255])) },
  { name: "neon-magenta", w: 40, h: 50, data: buf(40, 50, () => [255, 0, 220, 255]) },
  { name: "neon-on-black", w: 40, h: 50, data: buf(40, 50, (x, y) => ((x + y) % 5 === 0 ? [0, 255, 120, 255] : [6, 6, 8, 255])) },
  { name: "dense-checker", w: 40, h: 40, data: buf(40, 40, (x, y) => ((x + y) % 2 ? [12, 14, 20, 255] : [240, 238, 230, 255])) },
  { name: "airy-gradient", w: 48, h: 48, data: buf(48, 48, (x) => [Math.round((x / 48) * 255), 90, 200, 255]) },
  { name: "three-band", w: 48, h: 48, data: buf(48, 48, (x, y) => (y < 16 ? [244, 240, 232, 255] : y < 32 ? [30, 30, 40, 255] : [226, 89, 31, 255])) },
  { name: "transparent", w: 20, h: 20, data: buf(20, 20, () => [0, 0, 0, 0]) },
  { name: "half-transparent-vivid", w: 30, h: 30, data: buf(30, 30, (x) => (x < 15 ? [0, 150, 255, 255] : [0, 0, 0, 0])) },
  { name: "one-pixel", w: 1, h: 1, data: buf(1, 1, () => [123, 45, 200, 255]) },
  { name: "two-pixel", w: 2, h: 1, data: buf(2, 1, () => [10, 200, 90, 255]) },
  { name: "noise", w: 48, h: 48, data: (() => { const r = rng(99); return buf(48, 48, () => [Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256), 255]); })() },
];

// Extra hand-crafted extreme palettes fed straight through paletteFromExtracted,
// to hammer the contrast guarantee and the renderer with pathological colours.
const EXTREME: Palette[] = [
  paletteFromExtracted({ colors: ["#000000", "#010101"], bg: "#000000", fg: "#010101", accent: "#020202", dark: true, density: 0.2 }),
  paletteFromExtracted({ colors: ["#ffffff", "#fefefe"], bg: "#ffffff", fg: "#fefefe", accent: "#fdfdfd", dark: false, density: 0.05 }),
  paletteFromExtracted({ colors: ["#ff00ff", "#00ffff", "#ffff00"], bg: "#ff00ff", fg: "#00ffff", accent: "#ffff00", dark: false, density: 0.9 }),
  paletteFromExtracted({ colors: ["#0a0a0a"], bg: "#0a0a0a", fg: "#0a0a0a", accent: "#0a0a0a", dark: true, density: 0 }),
];

/* ------------------------------- assertions -------------------------------- */

function badNumbers(scene: Scene): string[] {
  const bad: string[] = [];
  const check = (v: unknown, path: string) => {
    if (typeof v === "number") { if (!Number.isFinite(v)) bad.push(`${path}=${v}`); return; }
    if (typeof v === "string") { if (/NaN|Infinity/.test(v)) bad.push(`${path}="${v}"`); return; }
    if (Array.isArray(v)) { v.forEach((x, i) => check(x, `${path}[${i}]`)); return; }
    if (v && typeof v === "object") for (const [k, val] of Object.entries(v)) check(val, `${path}.${k}`);
  };
  scene.nodes.forEach((n, i) => check(n, `node[${i}]:${(n as Node).kind}`));
  check(scene.bg, "bg");
  return bad;
}

function textNodes(scene: Scene): Extract<Node, { kind: "text" }>[] {
  const out: Extract<Node, { kind: "text" }>[] = [];
  const walk = (nodes: Node[]) => { for (const n of nodes) { if (n.kind === "text") out.push(n); else if (n.kind === "group") walk(n.children); } };
  walk(scene.nodes);
  return out;
}

const deck: Deck = writeOfflineDeck({
  topic: "Why most morning routines fall apart by week three",
  handle: "@carouselmaker",
  preset: getPreset("swiss"),
  slideCount: 8,
});

function render(presetId: string, palette: Palette, index: number): Scene {
  PALETTE_BY_ID.set(palette.id, palette); // the app registers derived palettes the same way
  const preset = getPreset(presetId);
  const ctx = makeCtx({
    deck, slide: deck.slides[index], index, total: deck.slides.length,
    pal: palette, fonts, m: metricMeasurer, pad: preset.pad,
  });
  return preset.render(ctx);
}

/* --------------------------------- tests ----------------------------------- */

describe("inspiration pipeline is robust across edge-case images", () => {
  it("derives a valid, readable palette from every synthetic image", () => {
    for (const img of IMAGES) {
      const insp = buildInspiration(img.data, img.w, img.h);
      const p = insp.palette;
      for (const key of ["bg", "fg", "accent", "accent2", "surface", "line"] as const) {
        expect(/^#[0-9a-f]{6}$/i.test(p[key]), `${img.name} → ${key}=${p[key]}`).toBe(true);
      }
      expect(Number.isFinite(insp.extracted.density), img.name).toBe(true);
      expect(PRESETS.some((pr) => pr.id === insp.presetId), `${img.name} → ${insp.presetId}`).toBe(true);
    }
  });
});

// The heart of the stress test: every derived/extreme palette × every preset.
const PALETTES: Palette[] = [...IMAGES.map((i) => buildInspiration(i.data, i.w, i.h).palette), ...EXTREME];

describe.each(PRESETS.map((p) => [p.id] as const))("preset %s survives any pulled palette", (id) => {
  it("renders cover + body through every derived and extreme palette", () => {
    PALETTES.forEach((pal, k) => {
      const tagged: Palette = { ...pal, id: `inspired-${k}` };
      for (const index of [0, 1]) {
        const scene = render(id, tagged, index);
        expect(scene.nodes.length, `${id}/${tagged.id} slide ${index}`).toBeGreaterThan(0);
        expect(badNumbers(scene), `${id}/${tagged.id} slide ${index}`).toEqual([]);
        for (const t of textNodes(scene)) {
          expect(t.size, `${id}/${tagged.id} font`).toBeGreaterThan(8);
          expect(t.lines.length, `${id}/${tagged.id} empty text`).toBeGreaterThan(0);
        }
      }
    });
  });
});
