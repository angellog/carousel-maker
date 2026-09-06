import type { Deck, Palette, Slide } from "../types";
import type { FontSet } from "../theme";
import { withAlpha } from "../theme";
import type { Node, Paint, TextAlign, TextNode } from "./scene";
import {
  blockHeight,
  fitText,
  type MarkTheme,
  type Measurer,
  wrapRich,
} from "./text";

export const CANVAS_W = 1080;
export const CANVAS_H = 1350; // 4:5, Instagram's tallest feed ratio

export interface Ctx {
  w: number;
  h: number;
  /** Safe margin — nothing important should sit outside this. */
  pad: number;
  pal: Palette;
  fonts: FontSet;
  m: Measurer;
  marks: MarkTheme;
  deck: Deck;
  slide: Slide;
  index: number;
  total: number;
  /** User-controlled global type multiplier (0.85 – 1.2). */
  typeScale: number;
  /** Deterministic per-slide randomness, so decoration never flickers. */
  rand: () => number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function contentBox(c: Ctx): Box {
  return { x: c.pad, y: c.pad, w: c.w - c.pad * 2, h: c.h - c.pad * 2 };
}

function seeded(seed: number): () => number {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function defaultMarks(pal: Palette): MarkTheme {
  return {
    accent: { color: pal.accent, weight: 800 },
    highlight: { highlight: withAlpha(pal.accent, 0.35) },
    underline: { underline: pal.accent },
    strike: { strike: pal.muted, color: pal.muted },
  };
}

export function makeCtx(args: {
  deck: Deck;
  slide: Slide;
  index: number;
  total: number;
  pal: Palette;
  fonts: FontSet;
  m: Measurer;
  typeScale?: number;
  pad?: number;
  marks?: MarkTheme;
}): Ctx {
  const pal = args.pal;
  return {
    w: CANVAS_W,
    h: CANVAS_H,
    pad: args.pad ?? 96,
    pal,
    fonts: args.fonts,
    m: args.m,
    marks: args.marks ?? defaultMarks(pal),
    deck: args.deck,
    slide: args.slide,
    index: args.index,
    total: args.total,
    typeScale: args.typeScale ?? 1,
    rand: seeded(hashString(args.slide.id) + args.index * 7919),
  };
}

/* ---------------------------- text helpers ---------------------------- */

export interface BlockOptions {
  x: number;
  y: number;
  w: number;
  maxH: number;
  font: string;
  weight?: number;
  italic?: boolean;
  max: number;
  min: number;
  lineHeight?: number;
  align?: TextAlign;
  color?: Paint;
  letterSpacing?: number;
  maxLines?: number;
  marks?: MarkTheme;
  uppercase?: boolean;
}

export interface Block {
  node: TextNode;
  height: number;
  size: number;
  lineCount: number;
  overflow: boolean;
}

/**
 * Shrink-to-fit text block. `x` is the anchor for the given alignment
 * (left edge, centre, or right edge) and `y` is the top of the block.
 */
export function block(c: Ctx, text: string, o: BlockOptions): Block {
  const align: TextAlign = o.align ?? "left";
  const lineHeight = o.lineHeight ?? 1.08;
  const src = o.uppercase ? text.toUpperCase() : text;
  const marks = o.marks ?? c.marks;
  const fit = fitText(
    src,
    marks,
    {
      font: o.font,
      weight: o.weight ?? 700,
      italic: o.italic,
      letterSpacing: o.letterSpacing,
    },
    c.m,
    {
      maxWidth: o.w,
      maxHeight: o.maxH,
      max: o.max * c.typeScale,
      min: o.min,
      lineHeight,
      maxLines: o.maxLines,
    },
  );
  const node: TextNode = {
    kind: "text",
    x: align === "left" ? o.x : align === "center" ? o.x + o.w / 2 : o.x + o.w,
    y: o.y,
    lines: fit.lines,
    font: o.font,
    size: fit.size,
    weight: o.weight ?? 700,
    italic: o.italic,
    lineHeight,
    color: o.color ?? c.pal.fg,
    align,
    letterSpacing: o.letterSpacing,
    boxWidth: o.w,
  };
  return {
    node,
    height: fit.height,
    size: fit.size,
    lineCount: fit.lines.length,
    overflow: fit.overflow,
  };
}

/** Fixed-size wrapped text (no shrink-to-fit). */
export function fixedBlock(
  c: Ctx,
  text: string,
  o: Omit<BlockOptions, "max" | "min" | "maxH"> & { size: number },
): Block {
  const align: TextAlign = o.align ?? "left";
  const lineHeight = o.lineHeight ?? 1.3;
  const src = o.uppercase ? text.toUpperCase() : text;
  const spec = {
    font: o.font,
    size: o.size * c.typeScale,
    weight: o.weight ?? 400,
    italic: o.italic,
    letterSpacing: o.letterSpacing,
  };
  const lines = wrapRich(src, o.marks ?? c.marks, o.w, spec, c.m);
  const node: TextNode = {
    kind: "text",
    x: align === "left" ? o.x : align === "center" ? o.x + o.w / 2 : o.x + o.w,
    y: o.y,
    lines,
    font: o.font,
    size: spec.size,
    weight: spec.weight,
    italic: o.italic,
    lineHeight,
    color: o.color ?? c.pal.fg,
    align,
    letterSpacing: o.letterSpacing,
    boxWidth: o.w,
  };
  return {
    node,
    height: blockHeight(lines, spec.size, lineHeight),
    size: spec.size,
    lineCount: lines.length,
    overflow: false,
  };
}

/** Measure a single unwrapped string. */
export function textWidth(
  c: Ctx,
  text: string,
  font: string,
  size: number,
  weight = 400,
  letterSpacing = 0,
): number {
  return c.m.width(text, { font, size, weight, letterSpacing });
}

/**
 * Vertically place a list of already-measured blocks inside a box.
 * Returns the y offsets. `justify` mirrors CSS flexbox semantics.
 */
export function stack(
  boxY: number,
  boxH: number,
  heights: number[],
  gap: number,
  justify: "start" | "center" | "end" | "between" = "start",
): number[] {
  const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, heights.length - 1);
  let y = boxY;
  let g = gap;
  if (justify === "center") y = boxY + (boxH - total) / 2;
  else if (justify === "end") y = boxY + boxH - total;
  else if (justify === "between" && heights.length > 1) {
    const sum = heights.reduce((a, b) => a + b, 0);
    g = (boxH - sum) / (heights.length - 1);
  }
  const out: number[] = [];
  for (const h of heights) {
    out.push(y);
    y += h + g;
  }
  return out;
}

export function pushAll(target: Node[], ...nodes: (Node | Node[] | null | undefined)[]) {
  for (const n of nodes) {
    if (!n) continue;
    if (Array.isArray(n)) target.push(...n);
    else target.push(n);
  }
}
