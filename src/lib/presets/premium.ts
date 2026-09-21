import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock } from "../render/ctx";
import * as D from "../render/decor";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyPart,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/**
 * Four premium editorial design systems. Each renders every pixel from vectors
 * and type — no image model — and degrades gracefully to a title-only slide.
 * The composition trick shared by all four: a shrink-to-fit headline plus a
 * single bounded feature (stat/quote), stacked with `justify: "center"`, so the
 * layout never overflows the canvas no matter how long or short the copy runs.
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

/** "03 / 09" folio, right- or left-anchored, in the mono face. */
function folio(c: Ctx, x: number, y: number, w: number, color: string, align: "left" | "right", size = 20): Node {
  const label = `${String(c.index + 1).padStart(2, "0")} / ${String(c.total).padStart(2, "0")}`;
  return fixedBlock(c, label, {
    x,
    y,
    w,
    size,
    font: c.fonts.mono,
    weight: 500,
    color,
    align,
    letterSpacing: 1.5,
    marks: {},
  }).node;
}

/* ------------------------------- 01 · Swiss ------------------------------ */

export const swiss: Preset = {
  id: "swiss",
  name: "Swiss",
  category: "minimal",
  blurb: "International Typographic Style: a strict grid, one red accent, huge flush-left type.",
  defaultPalette: "ink",
  palettes: ["ink", "slate", "paper", "mono"],
  needs: ["kicker", "body", "stat", "bullets", "note"],
  brief:
    "Write like a Swiss poster. Headlines are short, declarative and flush-left (3–8 words); one supporting sentence of real substance. When a slide has a number, put it in `stat` — Swiss loves one big figure. Keep everything spare and factual.",
  slideRange: [6, 10],
  pad: 84,
  render(c) {
    const isCover = c.slide.role === "cover";
    const cb = contentBox(c);
    const gridCol = withAlpha(c.pal.fg, c.pal.dark ? 0.06 : 0.045);
    const baseCol = withAlpha(c.pal.fg, c.pal.dark ? 0.05 : 0.04);
    const nodes: Node[] = [];

    // The grid itself is the decoration: faint column guides + baseline rules.
    const cols = 6;
    for (let i = 1; i < cols; i++) {
      const gx = cb.x + (cb.w * i) / cols;
      nodes.push({ kind: "line", x1: gx, y1: cb.y, x2: gx, y2: c.h - c.pad, stroke: gridCol, lineWidth: 1 });
    }
    for (let gy = cb.y + 48; gy < c.h - c.pad; gy += 48) {
      nodes.push({ kind: "line", x1: cb.x, y1: gy, x2: cb.x + cb.w, y2: gy, stroke: baseCol, lineWidth: 1 });
    }

    // Header row: a saturated accent square (the one accent) + a mono folio.
    nodes.push({ kind: "rect", x: cb.x, y: cb.y, w: 52, h: 52, fill: c.pal.accent });
    nodes.push(folio(c, cb.x + cb.w - 240, cb.y + 16, 240, c.pal.fg, "right", 22));

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: isCover ? 150 : 104,
      titleMin: 40,
      titleLH: 0.98,
      titleLS: -3,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: c.pal.muted,
      kickerFont: "mono",
      kickerWeight: 600,
      kickerSize: 20,
      kickerLS: 2,
      kickerUpper: true,
      kickerColor: c.pal.accent,
      bullet: "square",
      bulletColor: c.pal.accent,
      bulletGap: 22,
      gap: 30,
    });

    const top = cb.y + 52 + 46;
    const footTop = c.h - c.pad - 42;
    const box = { x: cb.x, y: top, w: cb.w, h: Math.max(200, footTop - top - 24) };
    // Only body slides carry feature furniture (a bounded stat/bullet block);
    // cover and CTA stay to kicker/title/body so the hook and close never
    // render empty — or, under pathological copy, unbounded — furniture.
    const parts = [kickerPart(c, s, box), titlePart(c, s, box), bodyPart(c, s, box)];
    if (c.slide.role === "body") parts.push(featurePart(c, s, box));
    parts.push(notePart(c, s, box));
    nodes.push(...layoutParts(parts, box, s.gap, s.justify));

    // Footer rule + handle / counter, all on the mono baseline.
    nodes.push({ kind: "line", x1: cb.x, y1: footTop, x2: cb.x + cb.w, y2: footTop, stroke: c.pal.fg, lineWidth: 1.5 });
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: footTop + 14,
          w: cb.w / 2,
          size: 20,
          font: c.fonts.mono,
          weight: 500,
          color: c.pal.muted,
          letterSpacing: 1,
          marks: {},
        }).node,
      );
    }
    nodes.push(folio(c, cb.x + cb.w - 240, footTop + 14, 240, c.pal.muted, "right", 20));
    nodes.push(D.grain(c, 0.03));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 02 · Magazine ----------------------------- */

export const magazine: Preset = {
  id: "magazine",
  name: "Magazine",
  category: "editorial",
  blurb: "High-fashion glossy: an oversized serif display line between hairline double rules.",
  defaultPalette: "cream",
  palettes: ["cream", "paper", "midnight", "clay"],
  needs: ["kicker", "body", "quote", "note"],
  brief:
    "Write like a glossy fashion feature. Headlines are evocative serif display lines (4–10 words), centred; wrap the single most charged word in **bold** so it renders as an italic accent. One elegant supporting sentence. Pull-quotes (`quote`) are welcome.",
  slideRange: [6, 10],
  pad: 88,
  render(c) {
    const isCover = c.slide.role === "cover";
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const marks = {
      accent: { italic: true, color: c.pal.accent },
      highlight: { highlight: withAlpha(c.pal.accent, 0.2) },
      underline: { underline: c.pal.accent },
      strike: { strike: c.pal.muted, color: c.pal.muted },
    };

    const rule = (y: number, w: number, alpha = 1): Node => ({
      kind: "line",
      x1: cb.x,
      y1: y,
      x2: cb.x + cb.w,
      y2: y,
      stroke: alpha === 1 ? c.pal.fg : withAlpha(c.pal.fg, alpha),
      lineWidth: w,
    });

    // Thin double rules, top and bottom.
    const topY = cb.y + 4;
    const botY = c.h - c.pad - 30;
    nodes.push(rule(topY, 2.4), rule(topY + 9, 1), rule(botY, 1), rule(botY + 9, 2.4));

    // The dropped folio, small caps, centred under the masthead rule.
    nodes.push(
      fixedBlock(c, `N° ${String(c.index + 1).padStart(2, "0")}`, {
        x: cb.x,
        y: topY + 24,
        w: cb.w,
        size: 22,
        font: c.fonts.serif,
        weight: 400,
        color: c.pal.muted,
        align: "center",
        letterSpacing: 4,
        marks: {},
      }).node,
    );

    const s = defaultShell(c, {
      align: "center",
      justify: "center",
      titleFont: "serif",
      titleWeight: 400,
      titleMax: isCover ? 128 : 100,
      titleMin: 36,
      titleLH: 1.04,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "serif",
      bodySize: 27,
      bodyLH: 1.5,
      bodyColor: c.pal.muted,
      kickerFont: "sans",
      kickerWeight: 700,
      kickerSize: 19,
      kickerLS: 5,
      kickerUpper: true,
      kickerColor: c.pal.accent,
      gap: 30,
      marks,
    });

    const top = topY + 74;
    const box = { x: cb.x + cb.w * 0.05, y: top, w: cb.w * 0.9, h: Math.max(240, botY - 40 - top) };
    const parts = [kickerPart(c, s, box), titlePart(c, s, box), bodyPart(c, s, box)];
    if (c.slide.role === "body") parts.push(featurePart(c, s, box));
    parts.push(notePart(c, s, box));
    nodes.push(...layoutParts(parts, box, s.gap, s.justify));

    // Footer: centred handle, page number to the right of the bottom rules.
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        fixedBlock(c, handle, {
          x: cb.x,
          y: botY + 22,
          w: cb.w,
          size: 20,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          align: "center",
          letterSpacing: 2,
          marks: {},
        }).node,
      );
    }
    nodes.push(D.grain(c, 0.05, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 03 · Whitepaper ---------------------------- */

export const whitepaper: Preset = {
  id: "whitepaper",
  name: "Whitepaper",
  category: "minimal",
  blurb: "A quiet corporate report: eyebrow chip, hairline rules, restrained type, one accent.",
  defaultPalette: "slate",
  palettes: ["slate", "paper", "cream", "notebook"],
  needs: ["kicker", "body", "stat", "items", "note"],
  brief:
    "Write like an authoritative report. `kicker` is a short section label (1–3 words) for the eyebrow chip. Headlines are measured and specific (5–12 words); body is one or two calm, evidence-led sentences. Use `stat` for a headline figure or `items` for a small metrics list.",
  slideRange: [6, 10],
  pad: 92,
  render(c) {
    const isCover = c.slide.role === "cover";
    const cb = contentBox(c);
    const nodes: Node[] = [];

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 700,
      titleMax: isCover ? 94 : 74,
      titleMin: 34,
      titleLH: 1.1,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodySize: 28,
      bodyLH: 1.52,
      bodyColor: c.pal.muted,
      bullet: "dash",
      bulletColor: c.pal.accent,
      gap: 28,
    });

    let y = cb.y;
    // Eyebrow chip — the single accent moment in the header.
    const label = c.slide.kicker?.trim() || (isCover ? "Report" : "Section");
    const probe = D.chip(c, label, {
      x: 0,
      y: 0,
      size: 18,
      fill: withAlpha(c.pal.accent, 0.12),
      color: c.pal.accent,
      radius: 8,
      letterSpacing: 2,
    });
    nodes.push(
      ...D.chip(c, label, {
        x: cb.x,
        y,
        size: 18,
        fill: withAlpha(c.pal.accent, 0.12),
        color: c.pal.accent,
        radius: 8,
        letterSpacing: 2,
      }).nodes,
    );
    y += probe.h + 22;
    nodes.push({ kind: "line", x1: cb.x, y1: y, x2: cb.x + cb.w, y2: y, stroke: withAlpha(c.pal.fg, 0.18), lineWidth: 1.5 });
    y += 30;

    const footTop = c.h - c.pad - 40;
    const box = { x: cb.x, y, w: cb.w, h: Math.max(220, footTop - y - 20) };
    const parts = [titlePart(c, s, box), bodyPart(c, s, box)];
    if (c.slide.role === "body") parts.push(featurePart(c, s, box));
    parts.push(notePart(c, s, box));
    nodes.push(...layoutParts(parts, box, s.gap, "center"));

    // Report footer: hairline rule, handle left, folio right.
    nodes.push({ kind: "line", x1: cb.x, y1: footTop, x2: cb.x + cb.w, y2: footTop, stroke: withAlpha(c.pal.fg, 0.18), lineWidth: 1.5 });
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
    nodes.push(folio(c, cb.x + cb.w - 240, footTop + 15, 240, c.pal.muted, "right", 19));
    nodes.push(D.grain(c, 0.025, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 04 · Manifesto ---------------------------- */

export const manifesto: Preset = {
  id: "manifesto",
  name: "Manifesto",
  category: "bold",
  blurb: "One saturated colour field, a huge tight headline reversed out, almost no chrome.",
  defaultPalette: "midnight",
  palettes: ["midnight", "ink", "forest", "sunset"],
  needs: ["kicker", "body", "note"],
  brief:
    "One committed idea per slide. Headlines are short, loud and absolute (2–7 words); underline the load-bearing word with **bold**. Body, if any, is a single sharp sentence. No lists, no data — just the statement, drenched in colour.",
  slideRange: [5, 9],
  pad: 92,
  render(c) {
    const field = c.pal.accent;
    const ink = readableInk(field);
    const soft = withAlpha(ink, 0.82);
    const faint = withAlpha(ink, 0.55);
    const isCover = c.slide.role === "cover";
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const marks = {
      accent: { underline: ink, weight: 800 },
      highlight: { highlight: withAlpha(ink, 0.24) },
      underline: { underline: ink },
      strike: { strike: faint, color: faint },
    };

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: isCover ? 150 : 122,
      titleMin: 44,
      titleLH: 0.98,
      titleLS: -3,
      titleColor: ink,
      titleUpper: true,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 30,
      bodyLH: 1.38,
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

    const box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - 64 };
    nodes.push(
      ...layoutParts(
        [kickerPart(c, s, box), titlePart(c, s, box, undefined, box.h * 0.74), bodyPart(c, s, box)],
        box,
        s.gap,
        "center",
      ),
    );

    // Minimal chrome: handle + note left, folio right, a hairline above them.
    const chromeY = c.h - c.pad + 4;
    nodes.push({ kind: "line", x1: cb.x, y1: chromeY - 20, x2: cb.x + cb.w, y2: chromeY - 20, stroke: withAlpha(ink, 0.3), lineWidth: 1.5 });
    const foot = c.slide.note?.trim() || c.deck.handle?.trim();
    if (foot) {
      nodes.push(
        fixedBlock(c, foot, {
          x: cb.x,
          y: chromeY,
          w: cb.w * 0.66,
          size: 19,
          font: c.fonts.sans,
          weight: 600,
          color: faint,
          letterSpacing: 0.5,
          marks: {},
        }).node,
      );
    }
    nodes.push(folio(c, cb.x + cb.w - 240, chromeY, 240, faint, "right", 19));
    nodes.push(D.grain(c, 0.06, ink));
    return scene(c, field, nodes);
  },
};

export const PREMIUM_PRESETS: Preset[] = [swiss, magazine, whitepaper, manifesto];
