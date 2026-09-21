import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock } from "../render/ctx";
import * as D from "../render/decor";
import type { Node, Paint } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  quotePart,
  scene,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/**
 * The editorial / minimal set: four canvas-rendered templates that lean on
 * type, rules and negative space rather than any image model. Each mirrors the
 * proven robustness pattern — a shrink-to-fit headline plus at most one bounded
 * feature, stacked with `justify: "center"` inside a fixed box — so the layout
 * never overflows regardless of copy length, and every slide degrades cleanly
 * to a title-only render.
 */

/** Pick black or white ink for legible type on an arbitrary solid fill. */
function readableInk(hex: string): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h.slice(0, 6);
  const n = parseInt(f, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? "#0a0a0a" : "#ffffff";
}

/** "03 / 09" index, in whatever face the template wants. */
function indexLabel(c: Ctx): string {
  return `${String(c.index + 1).padStart(2, "0")} / ${String(c.total).padStart(2, "0")}`;
}

/* ----------------------------- 01 · Broadsheet ---------------------------- */

export const broadsheet: Preset = {
  id: "broadsheet",
  name: "Broadsheet",
  category: "editorial",
  blurb: "A newspaper front page: masthead, heavy rules, a bold serif headline, a column rule.",
  defaultPalette: "paper",
  palettes: ["paper", "cream", "parchment", "slate"],
  needs: ["kicker", "body", "bullets", "stat", "note"],
  brief:
    "Write like a newspaper front page. The headline is a bold, factual serif line (5–12 words). `kicker` is a short section label (1–3 words, e.g. \"Analysis\"). `body` is one tight standfirst sentence. Put any figure in `stat`. Keep it declarative and specific — no hype.",
  slideRange: [5, 10],
  pad: 84,
  render(c) {
    const cb = contentBox(c);
    const isBody = c.slide.role === "body";
    const nodes: Node[] = [];
    const hair = (yy: number, w: number, alpha = 1): Node => ({
      kind: "line",
      x1: cb.x,
      y1: yy,
      x2: cb.x + cb.w,
      y2: yy,
      stroke: alpha === 1 ? c.pal.fg : withAlpha(c.pal.fg, alpha),
      lineWidth: w,
    });

    // ---- Masthead ----
    let y = cb.y;
    nodes.push(hair(y, 4), hair(y + 8, 1.5));
    y += 30;
    const paperName = (c.deck.handle?.replace(/^@/, "").trim() || "The Daily").toUpperCase();
    const name = fixedBlock(c, paperName, {
      x: cb.x,
      y,
      w: cb.w,
      size: 60,
      font: c.fonts.serif,
      weight: 800,
      color: c.pal.fg,
      align: "center",
      letterSpacing: 4,
      lineHeight: 1,
      marks: {},
    });
    nodes.push(name.node);
    y += name.height + 16;
    nodes.push(hair(y, 1));
    const dlY = y + 12;
    nodes.push(
      fixedBlock(c, "LATEST EDITION", {
        x: cb.x,
        y: dlY,
        w: cb.w / 2,
        size: 18,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.muted,
        letterSpacing: 3,
        marks: {},
      }).node,
      fixedBlock(c, `NO. ${String(c.index + 1).padStart(2, "0")}`, {
        x: cb.x + cb.w / 2,
        y: dlY,
        w: cb.w / 2,
        size: 18,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.muted,
        letterSpacing: 3,
        align: "right",
        marks: {},
      }).node,
    );
    y = dlY + 30;
    nodes.push(hair(y, 3));
    y += 30;

    // ---- Headline column ----
    const footTop = c.h - c.pad - 30;
    const box = { x: cb.x, y, w: cb.w, h: Math.max(220, footTop - y - 24) };

    // Thin column rule — the newspaper motif, kept faint so type reads over it.
    if (isBody) {
      nodes.push({
        kind: "line",
        x1: cb.x + cb.w / 2,
        y1: box.y + 18,
        x2: cb.x + cb.w / 2,
        y2: footTop - 12,
        stroke: withAlpha(c.pal.fg, 0.12),
        lineWidth: 1.5,
      });
    }

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "serif",
      titleWeight: 800,
      titleMax: isBody ? 84 : 108,
      titleMin: 34,
      titleLH: 1.04,
      titleLS: -1.5,
      titleColor: c.pal.fg,
      bodyFont: "serif",
      bodySize: 27,
      bodyLH: 1.5,
      bodyColor: c.pal.muted,
      kickerFont: "sans",
      kickerWeight: 800,
      kickerSize: 19,
      kickerLS: 4,
      kickerUpper: true,
      kickerColor: c.pal.accent,
      bullet: "square",
      bulletColor: c.pal.accent,
      gap: 26,
    });
    const parts = [
      kickerPart(c, s, box),
      titlePart(c, s, box, undefined, box.h * 0.5),
      bodyPart(c, s, box),
    ];
    if (isBody) parts.push(featurePart(c, s, box));
    parts.push(notePart(c, s, box));
    nodes.push(...layoutParts(parts, box, s.gap, "center"));

    // ---- Folio ----
    nodes.push(hair(footTop, 2));
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: footTop + 12,
          w: cb.w / 2,
          size: 19,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, `PAGE ${String(c.index + 1).padStart(2, "0")} OF ${String(c.total).padStart(2, "0")}`, {
        x: cb.x + cb.w / 2,
        y: footTop + 12,
        w: cb.w / 2,
        size: 17,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.muted,
        align: "right",
        letterSpacing: 1.5,
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.04, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 02 · Serifzine --------------------------- */

export const serifzine: Preset = {
  id: "serifzine",
  name: "Serif Zine",
  category: "editorial",
  blurb: "A literary magazine: an ornamental initial, generous serif leading, a pull-quote centrepiece.",
  defaultPalette: "cream",
  palettes: ["cream", "paper", "clay", "midnight"],
  needs: ["kicker", "quote", "body", "note"],
  brief:
    "Write like a literary magazine essay. Headlines are unhurried serif lines (5–12 words) with room to breathe. `body` is one considered sentence of real substance. Every body slide carries a `quote` — a sharp, screenshot-worthy pull-quote of 8–24 words, attributed to the author (use the handle) unless a named source is cited.",
  slideRange: [6, 10],
  pad: 100,
  render(c) {
    const cb = contentBox(c);
    const isBody = c.slide.role === "body";
    const nodes: Node[] = [];
    const footTop = c.h - c.pad - 34;

    // Top hairline and an ornamental dropped initial set in the wide left margin.
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: cb.y - 10,
      x2: cb.x + cb.w,
      y2: cb.y - 10,
      stroke: withAlpha(c.pal.fg, 0.5),
      lineWidth: 1,
    });
    const capGutter = 104;
    const capChar = (c.slide.title.trim()[0] || "A").toUpperCase();
    nodes.push(
      fixedBlock(c, capChar, {
        x: cb.x,
        y: cb.y + 4,
        w: capGutter,
        size: 118,
        font: c.fonts.serif,
        weight: 500,
        color: c.pal.accent,
        lineHeight: 1,
        marks: {},
      }).node,
    );

    const box = {
      x: cb.x + capGutter,
      y: cb.y,
      w: cb.w - capGutter,
      h: Math.max(240, footTop - cb.y),
    };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "serif",
      titleWeight: 400,
      titleMax: isBody ? 82 : 104,
      titleMin: 34,
      titleLH: 1.24,
      titleLS: -0.5,
      titleColor: c.pal.fg,
      bodyFont: "serif",
      bodySize: 27,
      bodyLH: 1.55,
      bodyColor: c.pal.muted,
      kickerFont: "sans",
      kickerWeight: 700,
      kickerSize: 19,
      kickerLS: 5,
      kickerUpper: true,
      kickerColor: c.pal.accent,
      gap: 30,
    });
    const parts = [
      kickerPart(c, s, box),
      titlePart(c, s, box, undefined, box.h * 0.42),
      bodyPart(c, s, box),
    ];
    if (isBody) parts.push(quotePart(c, s, box));
    parts.push(notePart(c, s, box));
    nodes.push(...layoutParts(parts, box, s.gap, "center"));

    // Bottom hairline, handle and folio.
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: footTop,
      x2: cb.x + cb.w,
      y2: footTop,
      stroke: withAlpha(c.pal.fg, 0.5),
      lineWidth: 1,
    });
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: footTop + 14,
          w: cb.w / 2,
          size: 19,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          letterSpacing: 1,
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, indexLabel(c), {
        x: cb.x + cb.w / 2,
        y: footTop + 14,
        w: cb.w / 2,
        size: 19,
        font: c.fonts.serif,
        weight: 400,
        color: c.pal.muted,
        align: "right",
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.05, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 03 · Minimalist --------------------------- */

export const minimalist: Preset = {
  id: "minimalist",
  name: "Minimalist",
  category: "minimal",
  blurb: "Extreme restraint: one small label, one measured line, vast whitespace, a single accent tick.",
  defaultPalette: "paper",
  palettes: ["paper", "slate", "ink", "mono"],
  needs: ["kicker", "note"],
  brief:
    "Say one thing per slide, quietly. `kicker` is a single short uppercase label (1–3 words). The title is one measured line (3–9 words) — the whole slide. No body, no lists, no data: the whitespace is the design. Let each line earn its place.",
  slideRange: [5, 9],
  pad: 110,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];

    // The single accent moment: a small tick at the top-left.
    nodes.push({ kind: "rect", x: cb.x, y: cb.y, w: 40, h: 6, fill: c.pal.accent });

    const top = cb.y + 30;
    const bottom = c.h - c.pad - 40;
    const box = { x: cb.x, y: top, w: cb.w, h: Math.max(200, bottom - top) };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 600,
      titleMax: 82,
      titleMin: 34,
      titleLH: 1.1,
      titleLS: -1,
      titleColor: c.pal.fg,
      kickerFont: "sans",
      kickerWeight: 600,
      kickerSize: 20,
      kickerLS: 5,
      kickerUpper: true,
      kickerColor: c.pal.muted,
      gap: 30,
    });
    nodes.push(
      ...layoutParts(
        [kickerPart(c, s, box), titlePart(c, s, box, undefined, box.h * 0.7)],
        box,
        s.gap,
        "center",
      ),
    );

    // Discreet chrome: handle left, index right. Almost nothing.
    const chromeY = c.h - c.pad + 6;
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: chromeY,
          w: cb.w / 2,
          size: 17,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          letterSpacing: 1,
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, indexLabel(c), {
        x: cb.x + cb.w / 2,
        y: chromeY,
        w: cb.w / 2,
        size: 17,
        font: c.fonts.mono,
        weight: 500,
        color: withAlpha(c.pal.muted, 0.85),
        align: "right",
        letterSpacing: 1,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------- 04 · Gradient --------------------------- */

export const gradient: Preset = {
  id: "gradient",
  name: "Gradient",
  category: "bold",
  blurb: "A drenched full-canvas gradient, a huge tight headline, one word lit up. Pure statement.",
  defaultPalette: "sunset",
  palettes: ["sunset", "electric", "midnight", "forest"],
  needs: ["kicker", "body", "note"],
  brief:
    "One committed statement per slide, drenched in colour. Headlines are short, loud and tight (2–7 words); wrap the single load-bearing word in **bold** so it lights up. `body`, if any, is one sharp sentence. No lists, no data — just the line.",
  slideRange: [5, 9],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const A = c.pal.accent;
    const B = c.pal.accent2;
    const isBody = c.slide.role === "body";

    // Ink is chosen from the gradient's midpoint luminance, so the headline
    // reads on both dark and light palettes.
    const ink = readableInk(mix(A, B, 0.5));
    const soft = withAlpha(ink, 0.82);
    const faint = withAlpha(ink, 0.5);

    // Full-canvas diagonal gradient from the palette's two accents, with a
    // mixed midpoint so it reads as a true gradient rather than a two-tone fill.
    const bg: Paint = {
      type: "linear",
      x0: 0,
      y0: 0,
      x1: c.w,
      y1: c.h,
      stops: [
        { offset: 0, color: A },
        { offset: 0.5, color: mix(A, B, 0.5) },
        { offset: 1, color: B },
      ],
    };

    const nodes: Node[] = [];
    // A soft radial highlight for depth — a vector answer to a lit background.
    const glow = mix(A, "#ffffff", 0.5);
    nodes.push({
      kind: "ellipse",
      cx: c.w * 0.72,
      cy: c.h * 0.22,
      rx: c.w * 0.9,
      ry: c.w * 0.9,
      fill: {
        type: "radial",
        cx: c.w * 0.72,
        cy: c.h * 0.22,
        r: c.w * 0.9,
        stops: [
          { offset: 0, color: withAlpha(glow, 0.38) },
          { offset: 1, color: withAlpha(glow, 0) },
        ],
      },
    });

    const marks = {
      accent: { highlight: withAlpha(ink, 0.2), weight: 900 },
      highlight: { highlight: withAlpha(ink, 0.2) },
      underline: { underline: ink },
      strike: { strike: faint, color: faint },
    };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: isBody ? 122 : 148,
      titleMin: 40,
      titleLH: 0.98,
      titleLS: -3,
      titleUpper: true,
      titleColor: ink,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: soft,
      kickerFont: "mono",
      kickerWeight: 600,
      kickerSize: 20,
      kickerLS: 3,
      kickerUpper: true,
      kickerColor: faint,
      gap: 30,
      marks,
    });
    const box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - 54 };
    nodes.push(
      ...layoutParts(
        [kickerPart(c, s, box), titlePart(c, s, box, undefined, box.h * 0.72), bodyPart(c, s, box)],
        box,
        s.gap,
        "center",
      ),
    );

    // Minimal chrome: a hairline, handle left, folio right.
    const chromeY = c.h - c.pad + 6;
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: chromeY - 20,
      x2: cb.x + cb.w,
      y2: chromeY - 20,
      stroke: withAlpha(ink, 0.28),
      lineWidth: 1.5,
    });
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: chromeY,
          w: cb.w * 0.6,
          size: 19,
          font: c.fonts.sans,
          weight: 700,
          color: soft,
          letterSpacing: 0.5,
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, indexLabel(c), {
        x: cb.x + cb.w * 0.4,
        y: chromeY,
        w: cb.w * 0.6,
        size: 19,
        font: c.fonts.mono,
        weight: 600,
        color: faint,
        align: "right",
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.05, ink));
    return scene(c, bg, nodes);
  },
};

export const PRESS_PRESETS: Preset[] = [broadsheet, serifzine, minimalist, gradient];
