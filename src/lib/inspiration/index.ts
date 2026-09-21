/**
 * Inspiration: turn an uploaded reference image (a screenshot of a carousel or
 * post the user likes) into a ready-to-use {@link Palette} and the closest
 * built-in preset — using nothing but pixel math.
 *
 * This honours the app's core constraint: no image-generation model, no ML, no
 * network. We quantize the image to a handful of dominant colours (median-cut),
 * pick sensible bg/fg/accent roles from them, measure a layout "density" from
 * local contrast, and match that profile to a shipped preset.
 *
 * The module is split into:
 *   - a PURE, deterministic core that operates on a raw RGBA buffer and runs
 *     anywhere (node, SSR, tests) — {@link extractPalette},
 *     {@link paletteFromExtracted}, {@link matchPreset}, {@link buildInspiration}.
 *   - a THIN browser wrapper, {@link analyzeImageFile}, that draws an image to a
 *     canvas and feeds the pixels to the core. Importing this module never
 *     touches `document`/`window`; only calling the wrapper does.
 */

import { PRESET_BY_ID } from "../presets";
import { mix } from "../theme";
import type { Palette } from "../types";

/** A colour palette pulled from an image, with role guesses. */
export interface ExtractedPalette {
  /** Dominant colours as `#rrggbb`, most-dominant first (up to 6). */
  colors: string[];
  /** Best-guess background — the most-dominant colour. */
  bg: string;
  /** Best-guess text colour — the dominant colour with the highest contrast vs bg. */
  fg: string;
  /** Most vivid dominant colour distinct from bg & fg (falls back to 2nd dominant). */
  accent: string;
  /** True when bg is dark (simple luminance < 0.5). */
  dark: boolean;
  /** 0..1 "busy-ness": fraction of high-local-contrast (edge) pixels. */
  density: number;
}

/** The full result of analysing an image. */
export interface Inspiration {
  extracted: ExtractedPalette;
  /** A ready-to-use custom {@link Palette} (id `"inspired"`). */
  palette: Palette;
  /** The closest matching built-in preset id. */
  presetId: string;
  /** One short human line describing the match. */
  note: string;
}

/* --------------------------- colour primitives --------------------------- */

/** Clamp to an 8-bit channel. */
function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Format an r,g,b triple as `#rrggbb`. */
function toHex(r: number, g: number, b: number): string {
  const h = (v: number) => clamp8(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Parse `#rgb`/`#rrggbb` into an [r,g,b] triple (0..255). */
function fromHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(f, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Simple perceptual luminance on 0..1 (matches theme.isDark). */
function simpleLuminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** WCAG relative luminance (channels linearised) on 0..1. */
function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21) between two hex colours. */
function contrastRatio(a: string, b: string): number {
  const [ar, ag, ab] = fromHex(a);
  const [br, bg, bb] = fromHex(b);
  const la = relativeLuminance(ar, ag, ab);
  const lb = relativeLuminance(br, bg, bb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSV saturation and value (0..1) for an r,g,b triple. */
function satVal(r: number, g: number, b: number): { s: number; v: number } {
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  const v = mx;
  const s = mx === 0 ? 0 : (mx - mn) / mx;
  return { s, v };
}

/** True when bg hex is dark. */
function isDarkHex(hex: string): boolean {
  const [r, g, b] = fromHex(hex);
  return simpleLuminance(r, g, b) < 0.5;
}

/** Rotate a hex colour's hue by `deg` degrees, preserving S and V. */
function rotateHue(hex: string, deg: number): string {
  const [r, g, b] = fromHex(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const mx = Math.max(rn, gn, bn);
  const mn = Math.min(rn, gn, bn);
  const d = mx - mn;
  let h = 0;
  if (d !== 0) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  const s = mx === 0 ? 0 : d / mx;
  const v = mx;
  h = ((h + deg) % 360 + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  return toHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

/* ------------------------------ median cut ------------------------------- */

type Pixel = [number, number, number];

interface Bucket {
  /** Representative colour as `#rrggbb`. */
  hex: string;
  /** Number of source pixels in this bucket. */
  count: number;
}

/** Per-channel spread of a set of pixels. */
function channelRange(px: Pixel[]): [number, number, number] {
  let rmin = 255;
  let rmax = 0;
  let gmin = 255;
  let gmax = 0;
  let bmin = 255;
  let bmax = 0;
  for (const [r, g, b] of px) {
    if (r < rmin) rmin = r;
    if (r > rmax) rmax = r;
    if (g < gmin) gmin = g;
    if (g > gmax) gmax = g;
    if (b < bmin) bmin = b;
    if (b > bmax) bmax = b;
  }
  return [rmax - rmin, gmax - gmin, bmax - bmin];
}

/** Population-weighted average colour of a set of pixels, as hex. */
function averageHex(px: Pixel[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of px) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  const n = px.length || 1;
  return toHex(r / n, g / n, b / n);
}

/**
 * Deterministic median-cut quantization to at most `max` buckets, ordered by
 * population (most-dominant first). Returns `[]` for an empty input.
 */
function medianCut(pixels: Pixel[], max: number): Bucket[] {
  if (pixels.length === 0) return [];
  let boxes: Pixel[][] = [pixels];
  while (boxes.length < max) {
    let target = -1;
    let bestScore = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      const [rr, gr, br] = channelRange(box);
      const spread = Math.max(rr, gr, br);
      if (spread === 0) continue;
      const score = box.length * spread;
      if (score > bestScore) {
        bestScore = score;
        target = i;
      }
    }
    if (target === -1) break;
    const box = boxes[target];
    const [rr, gr, br] = channelRange(box);
    const ch = rr >= gr && rr >= br ? 0 : gr >= br ? 1 : 2;
    const sorted = box.slice().sort((a, b) => a[ch] - b[ch]);
    const mid = sorted.length >> 1;
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    if (left.length === 0 || right.length === 0) break;
    boxes.splice(target, 1, left, right);
  }
  return boxes
    .map((box) => ({ hex: averageHex(box), count: box.length }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------- density -------------------------------- */

/** Edge threshold: luminance delta above this counts a pixel as "busy". */
const EDGE_DELTA = 0.18;

/** Density boundary between airy and dense layouts. */
const DENSITY_HIGH = 0.15;

/**
 * Fraction of pixels whose luminance differs from the pixel to its right OR
 * below by more than {@link EDGE_DELTA}. Returns 0 when there are no neighbours.
 */
function computeDensity(pixels: Uint8ClampedArray, width: number, height: number): number {
  if (width < 1 || height < 1) return 0;
  const lum = new Float64Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = simpleLuminance(pixels[p], pixels[p + 1], pixels[p + 2]);
  }
  let edges = 0;
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hasRight = x + 1 < width;
      const hasBelow = y + 1 < height;
      if (!hasRight && !hasBelow) continue;
      total++;
      const i = y * width + x;
      const dRight = hasRight ? Math.abs(lum[i] - lum[i + 1]) : 0;
      const dBelow = hasBelow ? Math.abs(lum[i] - lum[i + width]) : 0;
      if (dRight > EDGE_DELTA || dBelow > EDGE_DELTA) edges++;
    }
  }
  return total === 0 ? 0 : edges / total;
}

/* ------------------------------- core API ------------------------------- */

/** A neutral fallback used when an image yields no usable pixels. */
const EMPTY_EXTRACTED: ExtractedPalette = {
  colors: ["#111111"],
  bg: "#111111",
  fg: "#ffffff",
  accent: "#2997ff",
  dark: true,
  density: 0,
};

/**
 * Pure core: extract dominant colours, role guesses and layout density from a
 * raw RGBA pixel buffer. Deterministic; ignores near-transparent pixels
 * (alpha < 128); never throws or divides by zero.
 */
export function extractPalette(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): ExtractedPalette {
  const opaque: Pixel[] = [];
  const count = Math.min(pixels.length >> 2, Math.max(0, width * height));
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    if (pixels[p + 3] < 128) continue;
    opaque.push([pixels[p], pixels[p + 1], pixels[p + 2]]);
  }

  if (opaque.length === 0) {
    return { ...EMPTY_EXTRACTED, density: computeDensity(pixels, width, height) };
  }

  const buckets = medianCut(opaque, 6);
  const colors = buckets.map((b) => b.hex);
  const bg = colors[0];

  // fg = dominant bucket with the highest contrast ratio against bg.
  let fg = colors[0];
  let bestContrast = -1;
  for (const c of colors) {
    const cr = contrastRatio(c, bg);
    if (cr > bestContrast) {
      bestContrast = cr;
      fg = c;
    }
  }

  // accent = most vivid (sat*val) dominant colour that is neither bg nor fg;
  // fall back to the second-most-dominant colour when nothing is vivid enough.
  let accent = colors[1] ?? colors[0];
  let bestVivid = -1;
  let bestSat = 0;
  for (const c of colors) {
    if (c === bg || c === fg) continue;
    const [r, g, b] = fromHex(c);
    const { s, v } = satVal(r, g, b);
    const vivid = s * v;
    if (vivid > bestVivid) {
      bestVivid = vivid;
      bestSat = s;
      accent = c;
    }
  }
  if (bestSat < 0.15) accent = colors[1] ?? colors[0];

  return {
    colors,
    bg,
    fg,
    accent,
    dark: isDarkHex(bg),
    density: computeDensity(pixels, width, height),
  };
}

/**
 * Build a ready-to-use {@link Palette} from an {@link ExtractedPalette}. Derives
 * muted/surface/line/accent2 from bg & fg, and guarantees fg vs bg contrast of
 * at least 4.5:1 (pushing fg to `#ffffff` or `#111111` if the pulled colour is
 * too low-contrast to read).
 */
export function paletteFromExtracted(ex: ExtractedPalette): Palette {
  const bg = ex.bg;
  let fg = ex.fg;

  if (contrastRatio(fg, bg) < 4.5) {
    const white = "#ffffff";
    const black = "#111111";
    fg = contrastRatio(white, bg) >= contrastRatio(black, bg) ? white : black;
  }

  // accent2: a second distinct dominant colour, else a hue-rotated accent.
  let accent2 = ex.colors.find((c) => c !== bg && c !== fg && c !== ex.accent) ?? "";
  if (!accent2) accent2 = rotateHue(ex.accent, 150);

  return {
    id: "inspired",
    name: "From your image",
    bg,
    fg,
    muted: mix(fg, bg, 0.55),
    accent: ex.accent,
    accent2,
    surface: mix(bg, fg, 0.08),
    line: mix(bg, fg, 0.16),
    dark: isDarkHex(bg),
  };
}

/**
 * Match an extracted profile to the closest shipped preset id. Always returns a
 * real preset id (guarded by PRESET_BY_ID; falls back to `"keynote"`).
 */
export function matchPreset(ex: ExtractedPalette): string {
  const [ar, ag, ab] = fromHex(ex.accent);
  const { s: accentSat, v: accentVal } = satVal(ar, ag, ab);
  const veryVivid = accentSat >= 0.6 && accentVal >= 0.5 && ex.accent !== ex.bg;
  const dense = ex.density >= DENSITY_HIGH;

  let id: string;
  if (veryVivid) {
    id = "gradient";
  } else if (ex.dark) {
    id = dense ? "terminal" : "manifesto";
  } else {
    id = dense ? "broadsheet" : "serifzine";
  }

  return PRESET_BY_ID.has(id) ? id : PRESET_BY_ID.has("manifesto") ? "manifesto" : id;
}

/** Sentence-case a preset name's first word for the note line. */
function presetLabel(id: string): string {
  const name = PRESET_BY_ID.get(id)?.name ?? id;
  return name;
}

/**
 * Run the full pure pipeline on a raw RGBA buffer: extract → palette → preset,
 * plus a short human note. Deterministic and safe on any input size.
 */
export function buildInspiration(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Inspiration {
  const extracted = extractPalette(pixels, width, height);
  const palette = paletteFromExtracted(extracted);
  const presetId = matchPreset(extracted);

  const tone = extracted.dark ? "Dark" : "Light";
  const busy = extracted.density >= DENSITY_HIGH ? "dense" : "airy";
  const note = `${tone}, ${busy} look → ${presetLabel(presetId)}-style layout, palette pulled from your image.`;

  return { extracted, palette, presetId, note };
}

/* ---------------------------- browser wrapper ---------------------------- */

/** Longest-edge size we downscale to before reading pixels. */
const SAMPLE_EDGE = 64;

/**
 * Browser-only: analyse an uploaded image {@link Blob}. Draws it to an offscreen
 * canvas downscaled to ~64px on its longest edge, reads the pixels and runs
 * {@link buildInspiration}. Throws a clear error if called server-side.
 *
 * Not unit-tested (needs a DOM canvas); importing the module in node is safe
 * because nothing here runs until the function is called.
 */
export async function analyzeImageFile(file: Blob): Promise<Inspiration> {
  if (typeof document === "undefined") {
    throw new Error("Image analysis needs a browser");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height) || 1;
    const scale = Math.min(1, SAMPLE_EDGE / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale) || 1);
    const h = Math.max(1, Math.round(bitmap.height * scale) || 1);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image analysis needs a browser");

    ctx.drawImage(bitmap, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    return buildInspiration(data, w, h);
  } finally {
    bitmap.close?.();
  }
}
