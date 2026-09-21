import type { Ctx, Box } from "../render/ctx";
import { contentBox, fixedBlock } from "../render/ctx";
import * as D from "../render/decor";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyBox,
  bodyPart,
  coverScene,
  defaultShell,
  featurePart,
  itemsPart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* ------------------------------ helpers ------------------------------- */

/** Draftsman's corner registration crosshairs around a box. */
function regMarks(box: Box, color: string, len = 16, lineWidth = 1.5): Node[] {
  const corners: [number, number][] = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  const out: Node[] = [];
  for (const [x, y] of corners) {
    out.push(
      { kind: "line", x1: x - len, y1: y, x2: x + len, y2: y, stroke: color, lineWidth },
      { kind: "line", x1: x, y1: y - len, x2: x, y2: y + len, stroke: color, lineWidth },
    );
  }
  return out;
}

/** Two-digit ordinal for the current slide, always finite. */
function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

/* ---------------------------- 01 · Blueprint --------------------------- */

export const blueprint: Preset = {
  id: "blueprint",
  name: "Blueprint",
  category: "technical",
  blurb: "Drafting-table blue, a faint measurement grid, corner registration marks and a FIG. tag.",
  defaultPalette: "blueprint",
  palettes: ["blueprint", "terminal", "midnight", "slate"],
  needs: ["kicker", "body", "bullets", "stat", "note"],
  brief:
    "Write like an engineer annotating a diagram: a precise, declarative title (4–10 words) and one clarifying sentence of body. Kickers are short labels (the FIG. number is added for you). Use **accent** on the single load-bearing term.",
  slideRange: [7, 10],
  pad: 96,
  render(c) {
    if (c.slide.role === "cover") {
      return coverScene(c, {
        kickerFont: "mono",
        kickerLS: 4,
        titleFont: "sans",
        titleWeight: 800,
        titleLS: -2,
      });
    }
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const gridCol = withAlpha(c.pal.fg, c.pal.dark ? 0.08 : 0.06);
    nodes.push(...D.gridLines(c, 54, gridCol, 1));
    // Drafting frame + registration marks.
    nodes.push({
      kind: "rect",
      x: cb.x - 20,
      y: cb.y - 20,
      w: cb.w + 40,
      h: cb.h + 40,
      r: 4,
      stroke: withAlpha(c.pal.fg, 0.28),
      lineWidth: 1.5,
    });
    nodes.push(...regMarks({ x: cb.x - 20, y: cb.y - 20, w: cb.w + 40, h: cb.h + 40 }, withAlpha(c.pal.accent, 0.75)));

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 88,
      titleMin: 38,
      titleLH: 1.06,
      titleLS: -1.5,
      bodyFont: "sans",
      bodySize: 28,
      bodyLH: 1.44,
      kickerFont: "mono",
      kickerSize: 22,
      kickerLS: 4,
      kickerUpper: true,
      kickerColor: c.pal.accent,
      bullet: "square",
      bulletColor: c.pal.accent,
      gap: 30,
    });
    const box = bodyBox(c, 100);
    const fig = `FIG. ${pad2(c.index)}`;
    const kick = c.slide.kicker ? `${fig} — ${c.slide.kicker}` : fig;
    nodes.push(
      ...layoutParts(
        [
          kickerPart(c, s, box, kick),
          titlePart(c, s, box),
          bodyPart(c, s, box),
          featurePart(c, s, box),
          notePart(c, s, box),
        ],
        box,
        s.gap,
        s.justify,
      ),
    );
    // Scale-bar flourish, bottom-left, above the footer.
    const sbY = c.h - c.pad - 4;
    nodes.push(
      { kind: "line", x1: cb.x, y1: sbY, x2: cb.x + 120, y2: sbY, stroke: withAlpha(c.pal.fg, 0.5), lineWidth: 2 },
      { kind: "line", x1: cb.x, y1: sbY - 6, x2: cb.x, y2: sbY + 6, stroke: withAlpha(c.pal.fg, 0.5), lineWidth: 2 },
      { kind: "line", x1: cb.x + 60, y1: sbY - 4, x2: cb.x + 60, y2: sbY + 4, stroke: withAlpha(c.pal.fg, 0.5), lineWidth: 2 },
      { kind: "line", x1: cb.x + 120, y1: sbY - 6, x2: cb.x + 120, y2: sbY + 6, stroke: withAlpha(c.pal.fg, 0.5), lineWidth: 2 },
    );
    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.03));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 02 · Terminal --------------------------- */

export const terminal: Preset = {
  id: "terminal",
  name: "Terminal",
  category: "technical",
  blurb: "A monospace shell window: traffic-light dots, a $ prompt kicker and a blinking caret.",
  defaultPalette: "terminal",
  palettes: ["terminal", "midnight", "electric", "mono"],
  needs: ["kicker", "body", "bullets", "code", "note"],
  brief:
    "Write like terminal output: a short imperative title (3–8 words) and one line of body, plain and technical. Kickers read as commands (a $ prompt is added for you). Optionally supply `code` or `bullets`. Use **accent** on one keyword.",
  slideRange: [7, 10],
  pad: 84,
  render(c) {
    if (c.slide.role === "cover") {
      return coverScene(c, {
        kickerFont: "mono",
        kickerLS: 2,
        kickerUpper: false,
        titleFont: "mono",
        titleWeight: 700,
        titleLS: -1,
        bodyFont: "mono",
      });
    }
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const barH = 56;
    // Window frame.
    nodes.push({
      kind: "rect",
      x: cb.x,
      y: cb.y,
      w: cb.w,
      h: cb.h,
      r: 16,
      fill: withAlpha(c.pal.fg, c.pal.dark ? 0.03 : 0.02),
      stroke: withAlpha(c.pal.fg, 0.32),
      lineWidth: 2,
    });
    // Title bar.
    nodes.push({ kind: "rect", x: cb.x, y: cb.y, w: cb.w, h: barH, r: [16, 16, 0, 0], fill: c.pal.surface });
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: cb.y + barH,
      x2: cb.x + cb.w,
      y2: cb.y + barH,
      stroke: withAlpha(c.pal.fg, 0.3),
      lineWidth: 1.5,
    });
    ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
      nodes.push({ kind: "ellipse", cx: cb.x + 32 + i * 26, cy: cb.y + barH / 2, rx: 8, ry: 8, fill: col });
    });
    const fname = `${(c.deck.handle?.trim() || "deck").replace(/^@/, "")}.sh`;
    nodes.push(
      fixedBlock(c, fname, {
        x: cb.x,
        y: cb.y + barH / 2 - 13,
        w: cb.w,
        size: 22,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        align: "center",
        marks: {},
      }).node,
    );

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      kickerFont: "mono",
      kickerSize: 23,
      kickerLS: 1,
      kickerUpper: false,
      kickerColor: c.pal.accent,
      titleFont: "mono",
      titleWeight: 700,
      titleMax: 62,
      titleMin: 30,
      titleLH: 1.14,
      titleLS: -0.5,
      bodyFont: "mono",
      bodySize: 25,
      bodyLH: 1.5,
      bodyColor: c.pal.muted,
      bullet: "square",
      bulletColor: c.pal.accent,
      gap: 26,
    });
    const padIn = 46;
    const box: Box = {
      x: cb.x + padIn,
      y: cb.y + barH + padIn,
      w: cb.w - padIn * 2,
      h: cb.h - barH - padIn * 2 - 20,
    };
    const kick = c.slide.kicker ? `$ ${c.slide.kicker}` : "$ ./run";
    nodes.push(
      ...layoutParts(
        [
          kickerPart(c, s, box, kick),
          titlePart(c, s, box, undefined, box.h * 0.44),
          bodyPart(c, s, box),
          featurePart(c, s, box),
          notePart(c, s, box),
        ],
        box,
        s.gap,
        "start",
      ),
    );
    // Blinking caret at the very bottom-left of the window content.
    const caretY = cb.y + cb.h - padIn - 6;
    nodes.push(
      fixedBlock(c, "$", {
        x: box.x,
        y: caretY - 22,
        w: 40,
        size: 26,
        font: c.fonts.mono,
        weight: 700,
        color: c.pal.accent,
        marks: {},
      }).node,
      { kind: "rect", x: box.x + 26, y: caretY - 24, w: 16, h: 30, fill: withAlpha(c.pal.accent, 0.85) },
    );
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 03 · Brutalist --------------------------- */

export const brutalist: Preset = {
  id: "brutalist",
  name: "Brutalist",
  category: "bold",
  blurb: "Raw slab: full-width black rules, an inverted label block and an oversized condensed caps headline.",
  defaultPalette: "mono",
  palettes: ["mono", "ink", "amber", "electric"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Write loud and flat: a punchy headline of 2–7 words, rendered in oversized caps, and at most one blunt sentence of body. Kickers are terse labels ('MYTH', 'RULE 01'). Use **accent** on exactly one word.",
  slideRange: [6, 9],
  pad: 84,
  render(c) {
    if (c.slide.role === "cover") {
      return coverScene(c, {
        titleFont: "condensed",
        titleWeight: 800,
        titleUpper: true,
        titleLS: 0,
        titleMax: 150,
        titleMin: 52,
        titleLH: 0.96,
        kickerFont: "mono",
        kickerLS: 3,
        bodyFont: "mono",
      });
    }
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const ruleH = 16;
    // Heavy full-width rules top and bottom.
    nodes.push(
      { kind: "rect", x: 0, y: cb.y - 26, w: c.w, h: ruleH, fill: c.pal.fg },
      { kind: "rect", x: 0, y: c.h - c.pad + 10, w: c.w, h: ruleH, fill: c.pal.fg },
    );
    // Section marker under the top rule.
    nodes.push(
      { kind: "rect", x: cb.x, y: cb.y + 4, w: 20, h: 20, fill: c.pal.accent },
      fixedBlock(c, `NO. ${pad2(c.index)} / ${pad2(c.total)}`, {
        x: cb.x + 34,
        y: cb.y + 2,
        w: cb.w - 34,
        size: 22,
        font: c.fonts.mono,
        weight: 700,
        color: c.pal.fg,
        letterSpacing: 2,
        uppercase: true,
        marks: {},
      }).node,
    );

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "condensed",
      titleWeight: 800,
      titleUpper: true,
      titleMax: 132,
      titleMin: 52,
      titleLH: 0.98,
      titleLS: 0,
      bodyFont: "mono",
      bodySize: 26,
      bodyLH: 1.4,
      bodyColor: c.pal.fg,
      kickerFont: "mono",
      kickerSize: 24,
      kickerLS: 2,
      kickerUpper: true,
      kickerColor: c.pal.bg,
      kickerChip: { fill: c.pal.fg, color: c.pal.bg, radius: 0 },
      bullet: "square",
      bulletColor: c.pal.accent,
      gap: 30,
    });
    const box: Box = { x: cb.x, y: cb.y + 52, w: cb.w, h: cb.h - 52 - 60 };
    nodes.push(
      ...layoutParts(
        [
          kickerPart(c, s, box),
          titlePart(c, s, box, undefined, box.h * 0.6),
          bodyPart(c, s, box),
          featurePart(c, s, box),
          notePart(c, s, box),
        ],
        box,
        s.gap,
        "start",
      ),
    );
    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.035));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------- 04 · Spec ----------------------------- */

export const spec: Preset = {
  id: "spec",
  name: "Spec Sheet",
  category: "technical",
  blurb: "A product spec-sheet: titled header rule, then a key/value list with mono values and hairline dividers.",
  defaultPalette: "slate",
  palettes: ["slate", "paper", "blueprint", "mono"],
  needs: ["kicker", "body", "items", "stat", "note"],
  brief:
    "Write like a spec sheet. Give a short section title and fill `items` with 4–6 key/value rows: `label` is the property (1–3 words), `value` is the short spec ('12.4 mm', 'USB-C', '48 h'). Keep body to one framing sentence.",
  slideRange: [7, 10],
  pad: 92,
  render(c) {
    if (c.slide.role === "cover") {
      return coverScene(c, { kickerFont: "mono", kickerLS: 3 });
    }
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 64,
      titleMin: 32,
      titleLH: 1.06,
      titleLS: -1.4,
      bodyFont: "sans",
      bodySize: 25,
      bodyLH: 1.42,
      kickerFont: "mono",
      kickerSize: 21,
      kickerLS: 3,
      kickerColor: c.pal.accent,
      gap: 16,
    });

    let y = cb.y;
    for (const part of [
      kickerPart(c, s, cb),
      titlePart(c, s, cb, undefined, cb.h * 0.22),
      bodyPart(c, s, cb),
    ]) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 12;
    // Header rule: a heavy line over a hairline, spec-sheet style.
    nodes.push(
      { kind: "line", x1: cb.x, y1: y, x2: cb.x + cb.w, y2: y, stroke: c.pal.fg, lineWidth: 2.5 },
      { kind: "line", x1: cb.x, y1: y + 6, x2: cb.x + cb.w, y2: y + 6, stroke: withAlpha(c.pal.fg, 0.4), lineWidth: 1 },
    );
    // "SPECIFICATION" caption riding the rule.
    nodes.push(
      fixedBlock(c, "SPEC", {
        x: cb.x + cb.w - 120,
        y: y - 30,
        w: 120,
        size: 18,
        font: c.fonts.mono,
        weight: 700,
        color: c.pal.muted,
        letterSpacing: 3,
        align: "right",
        marks: {},
      }).node,
    );
    y += 30;

    const footH = c.slide.note ? 100 : 60;
    const zone: Box = { x: cb.x, y, w: cb.w, h: Math.max(120, c.h - c.pad - footH - y) };
    const items = itemsPart(c, s, zone, { mono: true, dotted: true });
    if (items) {
      nodes.push(...items.draw(y));
    } else {
      const f = featurePart(c, s, zone) ?? bodyPart(c, s, { ...zone });
      if (f) nodes.push(...f.draw(y));
    }

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 86,
          w: cb.w,
          size: 20,
          font: c.fonts.mono,
          weight: 500,
          color: c.pal.muted,
          letterSpacing: 0.5,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

export const TECHNICAL_PRESETS: Preset[] = [blueprint, terminal, brutalist, spec];
