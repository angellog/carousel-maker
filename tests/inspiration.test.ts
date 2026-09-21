import { describe, expect, it } from "vitest";
import {
  buildInspiration,
  extractPalette,
  matchPreset,
  paletteFromExtracted,
  type ExtractedPalette,
} from "@/lib/inspiration";
import { PRESET_BY_ID } from "@/lib/presets";

/* -------------------------------- helpers -------------------------------- */

/** Build an RGBA buffer from a per-pixel colour function. */
function buf(
  w: number,
  h: number,
  fn: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, al] = fn(x, y);
      const p = (y * w + x) * 4;
      a[p] = r;
      a[p + 1] = g;
      a[p + 2] = b;
      a[p + 3] = al;
    }
  }
  return a;
}

const HEX = /^#[0-9a-f]{6}$/;

/** WCAG contrast ratio between two hex colours (independent of the module). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* --------------------------- synthetic fixtures -------------------------- */

// Three balanced vertical thirds: white / vivid red / near-black.
const THREE = buf(9, 3, (x) => (x < 3 ? [245, 245, 245, 255] : x < 6 ? [230, 20, 20, 255] : [15, 15, 15, 255]));
// Black/white checkerboard — maximally busy, dark-dominant.
const CHECKER = buf(8, 8, (x, y) => ((x + y) % 2 === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
// Busy but light checkerboard (white / mid-grey).
const LIGHT_BUSY = buf(8, 8, (x, y) => ((x + y) % 2 === 0 ? [255, 255, 255, 255] : [160, 160, 160, 255]));
// Solid mid-grey (low contrast against itself).
const SOLID_GREY = buf(6, 6, () => [128, 128, 128, 255]);
// Solid dark, airy.
const SOLID_DARK = buf(6, 6, () => [16, 24, 32, 255]);
// Solid light, airy.
const SOLID_LIGHT = buf(6, 6, () => [221, 221, 221, 255]);
// Fully transparent.
const TRANSPARENT = buf(4, 4, () => [123, 45, 67, 0]);
// Single pixel.
const ONE = buf(1, 1, () => [200, 30, 90, 255]);

/* --------------------------------- tests -------------------------------- */

describe("extractPalette", () => {
  it("finds a light background and a dark, high-contrast foreground", () => {
    const ex = extractPalette(THREE, 9, 3);
    expect(ex.bg).toMatch(HEX);
    expect(ex.dark).toBe(false);
    expect(ex.colors[0]).toBe(ex.bg); // most-dominant first
    expect(contrast(ex.fg, ex.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("picks a vivid accent distinct from bg and fg", () => {
    const ex = extractPalette(THREE, 9, 3);
    expect(ex.accent).toMatch(HEX);
    expect(ex.accent).not.toBe(ex.bg);
    expect(ex.accent).not.toBe(ex.fg);
  });

  it("returns a dark flag matching a dark-dominant image", () => {
    const ex = extractPalette(CHECKER, 8, 8);
    expect(ex.bg).toBe("#000000");
    expect(ex.dark).toBe(true);
  });

  it("scores a checkerboard as very dense and a solid fill as flat", () => {
    expect(extractPalette(CHECKER, 8, 8).density).toBeGreaterThan(0.5);
    expect(extractPalette(SOLID_GREY, 6, 6).density).toBe(0);
    expect(extractPalette(SOLID_DARK, 6, 6).density).toBe(0);
  });

  it("emits only valid #rrggbb colours, most-dominant first", () => {
    const ex = extractPalette(THREE, 9, 3);
    expect(ex.colors.length).toBeGreaterThan(0);
    for (const c of ex.colors) expect(c).toMatch(HEX);
  });

  it("is deterministic across repeated calls", () => {
    expect(extractPalette(THREE, 9, 3)).toEqual(extractPalette(THREE, 9, 3));
    expect(buildInspiration(CHECKER, 8, 8)).toEqual(buildInspiration(CHECKER, 8, 8));
  });
});

describe("paletteFromExtracted", () => {
  it("guarantees fg vs bg contrast >= 4.5:1 even from a flat grey image", () => {
    const pal = paletteFromExtracted(extractPalette(SOLID_GREY, 6, 6));
    expect(contrast(pal.fg, pal.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a readable palette for the three-colour image", () => {
    const pal = paletteFromExtracted(extractPalette(THREE, 9, 3));
    expect(contrast(pal.fg, pal.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("produces a complete, well-formed Palette", () => {
    const pal = paletteFromExtracted(extractPalette(THREE, 9, 3));
    expect(pal.id).toBe("inspired");
    expect(pal.name).toBe("From your image");
    for (const k of ["bg", "fg", "muted", "accent", "accent2", "surface", "line"] as const) {
      expect(pal[k], k).toMatch(HEX);
    }
    expect(typeof pal.dark).toBe("boolean");
  });
});

describe("matchPreset", () => {
  it("maps a vivid image to gradient", () => {
    expect(matchPreset(extractPalette(THREE, 9, 3))).toBe("gradient");
  });

  it("maps a dark, dense image to terminal", () => {
    expect(matchPreset(extractPalette(CHECKER, 8, 8))).toBe("terminal");
  });

  it("maps a dark, airy image to manifesto", () => {
    expect(matchPreset(extractPalette(SOLID_DARK, 6, 6))).toBe("manifesto");
  });

  it("maps a light, airy image to serifzine", () => {
    expect(matchPreset(extractPalette(SOLID_LIGHT, 6, 6))).toBe("serifzine");
  });

  it("maps a light, dense image to broadsheet", () => {
    expect(matchPreset(extractPalette(LIGHT_BUSY, 8, 8))).toBe("broadsheet");
  });

  it("always returns a real preset id for every fixture", () => {
    for (const [b, w, h] of [
      [THREE, 9, 3],
      [CHECKER, 8, 8],
      [LIGHT_BUSY, 8, 8],
      [SOLID_GREY, 6, 6],
      [SOLID_DARK, 6, 6],
      [SOLID_LIGHT, 6, 6],
      [TRANSPARENT, 4, 4],
      [ONE, 1, 1],
    ] as const) {
      expect(PRESET_BY_ID.has(matchPreset(extractPalette(b, w, h)))).toBe(true);
    }
  });
});

describe("buildInspiration", () => {
  it("returns a full result with a note and a valid preset", () => {
    const insp = buildInspiration(THREE, 9, 3);
    expect(insp.note.length).toBeGreaterThan(10);
    expect(PRESET_BY_ID.has(insp.presetId)).toBe(true);
    expect(insp.palette.id).toBe("inspired");
    expect(insp.extracted.colors[0]).toBe(insp.extracted.bg);
  });

  it("survives an all-transparent image without throwing", () => {
    const insp = buildInspiration(TRANSPARENT, 4, 4);
    expect(contrast(insp.palette.fg, insp.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(PRESET_BY_ID.has(insp.presetId)).toBe(true);
    for (const k of ["bg", "fg", "accent", "accent2"] as const) {
      expect(insp.palette[k]).toMatch(HEX);
    }
  });

  it("survives a 1x1 image without dividing by zero", () => {
    const insp = buildInspiration(ONE, 1, 1);
    expect(insp.extracted.density).toBe(0);
    expect(contrast(insp.palette.fg, insp.palette.bg)).toBeGreaterThanOrEqual(4.5);
    expect(PRESET_BY_ID.has(insp.presetId)).toBe(true);
  });

  it("tolerates a zero-area / empty buffer", () => {
    const insp = buildInspiration(new Uint8ClampedArray(0), 0, 0);
    expect(insp.palette.id).toBe("inspired");
    expect(insp.palette.bg).toMatch(HEX);
    expect(PRESET_BY_ID.has(insp.presetId)).toBe(true);
  });
});

// Keep the ExtractedPalette shape referenced so the type export is exercised.
const _shape: ExtractedPalette = extractPalette(ONE, 1, 1);
void _shape;
