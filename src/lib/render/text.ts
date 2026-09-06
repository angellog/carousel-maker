import type { SpanStyle, TextLine, Token } from "./scene";

/* ------------------------------------------------------------------ *
 * Inline markup
 * ------------------------------------------------------------------ */

export type Mark = "accent" | "highlight" | "underline" | "strike";

export interface MarkTheme {
  accent?: SpanStyle;
  highlight?: SpanStyle;
  underline?: SpanStyle;
  strike?: SpanStyle;
}

const MARKERS: { open: string; mark: Mark }[] = [
  { open: "**", mark: "accent" },
  { open: "==", mark: "highlight" },
  { open: "__", mark: "underline" },
  { open: "~~", mark: "strike" },
];

/** Strip all markup — used for word counts, captions and alt text. */
export function plain(text: string): string {
  return text.replace(/\*\*|==|__|~~/g, "");
}

function mergeStyle(marks: Mark[], theme: MarkTheme): SpanStyle | undefined {
  if (marks.length === 0) return undefined;
  const out: SpanStyle = {};
  for (const m of marks) Object.assign(out, theme[m] ?? {});
  return Object.keys(out).length ? out : undefined;
}

/**
 * Split `text` into word tokens, carrying inline-markup styling.
 * Unclosed markers are treated as literal text so bad model output can never
 * swallow a whole slide.
 */
export function parseRich(text: string, theme: MarkTheme): Token[] {
  const runs: { text: string; marks: Mark[] }[] = [];
  const stack: Mark[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) runs.push({ text: buf, marks: [...stack] });
    buf = "";
  };
  while (i < text.length) {
    const two = text.slice(i, i + 2);
    const found = MARKERS.find((m) => m.open === two);
    if (found) {
      const openIdx = stack.lastIndexOf(found.mark);
      if (openIdx >= 0) {
        flush();
        stack.splice(openIdx, 1);
        i += 2;
        continue;
      }
      // Only open when a matching close exists later.
      if (text.indexOf(two, i + 2) > -1) {
        flush();
        stack.push(found.mark);
        i += 2;
        continue;
      }
    }
    buf += text[i];
    i += 1;
  }
  flush();

  const tokens: Token[] = [];
  // A run boundary only separates words if there was whitespace on one side of
  // it; otherwise the first word of the next run hugged the previous one.
  let prevEndedInSpace = true;
  for (const run of runs) {
    if (!run.text) continue;
    const style = mergeStyle(run.marks, theme);
    const leadingSpace = /^\s/.test(run.text);
    let first = true;
    for (const word of run.text.split(/\s+/)) {
      if (!word) continue;
      const token: Token = style ? { text: word, style } : { text: word };
      if (first && !leadingSpace && !prevEndedInSpace && tokens.length > 0) {
        token.glue = true;
      }
      tokens.push(token);
      first = false;
    }
    prevEndedInSpace = /\s$/.test(run.text);
  }
  return tokens;
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

export interface FontSpec {
  font: string;
  size: number;
  weight: number;
  italic?: boolean;
  letterSpacing?: number;
}

export interface Measurer {
  width(text: string, spec: FontSpec): number;
}

export function cssFont(spec: FontSpec): string {
  return `${spec.italic ? "italic " : ""}${spec.weight} ${spec.size}px ${spec.font}`;
}

/**
 * Wraps a raw width function with a size-100 cache.
 *
 * Widths scale linearly with font size, so one measurement per (text, face)
 * serves every size. Letter-spacing does NOT scale with size — it is a fixed
 * per-character offset — so it is deliberately excluded from the cached value
 * and added afterwards. Folding it into the cache was a real bug: negative
 * tracking produced hugely negative widths and painted words on top of one
 * another.
 */
export function makeCachedMeasurer(
  rawWidth: (text: string, spec: FontSpec) => number,
  limit = 6000,
): Measurer {
  const cache = new Map<string, number>();
  return {
    width(text, spec) {
      const key = `${spec.weight}|${spec.italic ? 1 : 0}|${spec.font}|${text}`;
      let base = cache.get(key);
      if (base === undefined) {
        base = rawWidth(text, { ...spec, size: 100, letterSpacing: 0 });
        if (cache.size >= limit) cache.clear();
        cache.set(key, base);
      }
      return (base * spec.size) / 100 + (spec.letterSpacing ?? 0) * text.length;
    },
  };
}

/**
 * Browser measurer backed by a scratch 2D context.
 * Falls back to the metric measurer when no canvas is available (SSR).
 */
export function createMeasurer(
  makeCanvas?: (w: number, h: number) => HTMLCanvasElement,
): Measurer {
  let ctx: CanvasRenderingContext2D | null = null;
  if (makeCanvas) {
    ctx = makeCanvas(8, 8).getContext("2d");
  } else if (typeof document !== "undefined") {
    const c = document.createElement("canvas");
    c.width = c.height = 8;
    ctx = c.getContext("2d");
  }
  if (!ctx) return metricMeasurer;
  const c2d = ctx;
  return makeCachedMeasurer((text, spec) => {
    c2d.font = cssFont(spec);
    return c2d.measureText(text).width;
  });
}

/**
 * Deterministic width model used in tests and during SSR. Approximates a
 * humanist sans; good enough for layout assertions, never used for export.
 */
const NARROW = new Set("iIjlt.,:;'`|!()[]{}/\\-".split(""));
const WIDE = new Set("mwMW@%".split(""));
export const metricMeasurer: Measurer = {
  width(text, spec) {
    let units = 0;
    for (const ch of text) {
      if (NARROW.has(ch)) units += 0.32;
      else if (WIDE.has(ch)) units += 0.92;
      else if (ch === " ") units += 0.28;
      else if (ch >= "A" && ch <= "Z") units += 0.66;
      else if (ch >= "0" && ch <= "9") units += 0.58;
      else units += 0.53;
    }
    const weightFactor = 1 + (spec.weight - 400) * 0.00022;
    const mono = /mono/i.test(spec.font) ? 1.12 : 1;
    return units * spec.size * weightFactor * mono + (spec.letterSpacing ?? 0) * text.length;
  },
};

/* ------------------------------------------------------------------ *
 * Wrapping + auto-fit
 * ------------------------------------------------------------------ */

function tokenWidth(t: Token, spec: FontSpec, m: Measurer): number {
  const s: FontSpec = {
    ...spec,
    weight: t.style?.weight ?? spec.weight,
    italic: t.style?.italic ?? spec.italic,
  };
  return m.width(t.text, s);
}

/**
 * Greedy word wrap. Glued tokens (punctuation after a markup boundary) travel
 * with the word they follow, so a stray comma can never wrap onto its own line.
 * Words wider than the box get their own line rather than being clipped.
 */
export function wrapTokens(
  tokens: Token[],
  maxWidth: number,
  spec: FontSpec,
  m: Measurer,
): TextLine[] {
  const space = m.width(" ", spec);
  const groups: { tokens: Token[]; width: number }[] = [];
  for (const t of tokens) {
    const w = tokenWidth(t, spec, m);
    const last = groups[groups.length - 1];
    if (t.glue && last) {
      last.tokens.push(t);
      last.width += w;
    } else {
      groups.push({ tokens: [t], width: w });
    }
  }

  const lines: TextLine[] = [];
  let cur: Token[] = [];
  let curW = 0;
  for (const g of groups) {
    const next = cur.length === 0 ? g.width : curW + space + g.width;
    if (cur.length > 0 && next > maxWidth) {
      lines.push({ tokens: cur, width: curW });
      cur = [...g.tokens];
      curW = g.width;
    } else {
      cur.push(...g.tokens);
      curW = next;
    }
  }
  if (cur.length) lines.push({ tokens: cur, width: curW });
  return lines.length ? lines : [{ tokens: [], width: 0 }];
}

/** Explicit line breaks (`\n`) are honoured, then each paragraph is wrapped. */
export function wrapRich(
  text: string,
  markTheme: MarkTheme,
  maxWidth: number,
  spec: FontSpec,
  m: Measurer,
): TextLine[] {
  const out: TextLine[] = [];
  for (const para of text.split("\n")) {
    const tokens = parseRich(para, markTheme);
    if (tokens.length === 0) {
      out.push({ tokens: [], width: 0 });
      continue;
    }
    out.push(...wrapTokens(tokens, maxWidth, spec, m));
  }
  return out;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  /** Starting (largest desirable) size. */
  max: number;
  /** Never go below this — presets should widen the box instead. */
  min: number;
  lineHeight: number;
  /** Prefer sizes that produce at most this many lines, when achievable. */
  maxLines?: number;
  step?: number;
}

export interface FitResult {
  lines: TextLine[];
  size: number;
  height: number;
  /** True when even `min` overflowed — the caller may want to clamp. */
  overflow: boolean;
}

/**
 * Shrink-to-fit type. This is what keeps 25 presets robust against copy of any
 * length: a headline is given a box, not a font size.
 */
export function fitText(
  text: string,
  markTheme: MarkTheme,
  spec: Omit<FontSpec, "size">,
  m: Measurer,
  opts: FitOptions,
): FitResult {
  const step = opts.step ?? 2;
  let last: FitResult | null = null;
  for (let size = opts.max; size >= opts.min; size -= step) {
    const s: FontSpec = { ...spec, size };
    const lines = wrapRich(text, markTheme, opts.maxWidth, s, m);
    const height = lines.length * size * opts.lineHeight;
    const widest = Math.max(0, ...lines.map((l) => l.width));
    last = { lines, size, height, overflow: false };
    const linesOk = opts.maxLines === undefined || lines.length <= opts.maxLines;
    if (height <= opts.maxHeight && widest <= opts.maxWidth + 0.5 && linesOk) return last;
  }
  const s: FontSpec = { ...spec, size: opts.min };
  const lines = wrapRich(text, markTheme, opts.maxWidth, s, m);
  return {
    lines,
    size: opts.min,
    height: lines.length * opts.min * opts.lineHeight,
    overflow: lines.length * opts.min * opts.lineHeight > opts.maxHeight,
  };
}

/** Total rendered height of a wrapped block. */
export function blockHeight(lines: TextLine[], size: number, lineHeight: number): number {
  return lines.length * size * lineHeight;
}
