import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import type { Node } from "../render/scene";
import * as D from "../render/decor";
import { mix, withAlpha } from "../theme";
import {
  bodyBox,
  composeStack,
  defaultShell,
  layoutParts,
  quotePart,
  scene,
  titlePart,
  bodyPart,
  kickerPart,
  featurePart,
  notePart,
} from "./_shared";
import type { Preset } from "./types";

/* ---------------------------- 01 · Keynote ---------------------------- */

export const keynote: Preset = {
  id: "keynote",
  name: "Keynote",
  category: "minimal",
  blurb: "Pure black, one idea per slide, oversized type. The stage-lit look.",
  defaultPalette: "midnight",
  palettes: ["midnight", "mono", "electric", "forest", "sunset"],
  needs: ["kicker", "body", "bullets", "stat"],
  brief:
    "One single idea per slide. Titles are short and declarative (3–9 words). Body is at most one sentence. Use **accent** on the one word that carries the idea.",
  slideRange: [7, 10],
  pad: 104,
  render(c) {
    const box = bodyBox(c, 104);
    const isCover = c.slide.role === "cover";
    const s = defaultShell(c, {
      align: isCover ? "left" : "left",
      justify: "center",
      titleMax: isCover ? 128 : 100,
      titleMin: 44,
      titleLH: 1.02,
      titleLS: -3,
      titleWeight: 800,
      bodySize: 34,
      bodyColor: c.pal.muted,
      kickerColor: c.pal.accent,
      kickerSize: 23,
      gap: 38,
    });
    const nodes: Node[] = [];
    nodes.push({
      kind: "rect",
      x: c.pad,
      y: c.pad - 34,
      w: 64,
      h: 6,
      fill: c.pal.accent,
    });
    nodes.push(...composeStack(c, s, { ...box, y: box.y + 24, h: box.h - 24 }));
    nodes.push(...D.footer(c));
    nodes.push(...D.progressDots(c, c.w / 2 - ((c.total - 1) * 16) / 2, c.h - 30, 16, 4));
    nodes.push(D.grain(c, 0.03));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 02 · Editorial --------------------------- */

export const editorial: Preset = {
  id: "editorial",
  name: "Editorial",
  category: "editorial",
  blurb: "Cream paper, serif headlines, hairline rules. Reads like a magazine feature.",
  defaultPalette: "cream",
  palettes: ["cream", "paper", "clay", "slate"],
  needs: ["kicker", "body", "bullets", "quote", "note"],
  brief:
    "Write like a long-form magazine deck: a considered headline (5–12 words) and one supporting sentence with real substance. Prefer specifics and numbers over hype.",
  slideRange: [8, 10],
  pad: 96,
  render(c) {
    const box = bodyBox(c, 110);
    const isCover = c.slide.role === "cover";
    const s = defaultShell(c, {
      align: "left",
      justify: isCover ? "end" : "center",
      titleFont: "serif",
      titleWeight: 400,
      titleMax: isCover ? 118 : 88,
      titleMin: 38,
      titleLH: 1.08,
      titleLS: -1,
      bodyFont: "sans",
      bodySize: 29,
      bodyLH: 1.5,
      kickerFont: "sans",
      kickerSize: 20,
      kickerLS: 4,
      kickerColor: c.pal.accent,
      bullet: "dash",
      bulletColor: c.pal.accent,
      gap: 30,
    });
    const nodes: Node[] = [];
    const cb = contentBox(c);
    nodes.push(
      { kind: "line", x1: cb.x, y1: cb.y - 26, x2: cb.x + cb.w, y2: cb.y - 26, stroke: c.pal.fg, lineWidth: 2.5 },
      { kind: "line", x1: cb.x, y1: cb.y - 18, x2: cb.x + cb.w, y2: cb.y - 18, stroke: c.pal.fg, lineWidth: 1 },
      { kind: "line", x1: cb.x, y1: c.h - c.pad + 18, x2: cb.x + cb.w, y2: c.h - c.pad + 18, stroke: withAlpha(c.pal.fg, 0.35), lineWidth: 1 },
    );
    nodes.push(...composeStack(c, s, box));
    // Folio
    const folio = `${String(c.index + 1).padStart(2, "0")}`;
    nodes.push(
      fixedBlock(c, folio, {
        x: cb.x + cb.w - 60,
        y: c.h - c.pad + 32,
        w: 60,
        size: 22,
        font: c.fonts.serif,
        weight: 400,
        color: c.pal.muted,
        align: "right",
        marks: {},
      }).node,
      fixedBlock(c, c.deck.handle || c.deck.topic.slice(0, 28), {
        x: cb.x,
        y: c.h - c.pad + 32,
        w: cb.w - 80,
        size: 20,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.muted,
        letterSpacing: 2,
        uppercase: true,
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.05, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 03 · Swiss ----------------------------- */

export const swiss: Preset = {
  id: "swiss",
  name: "Neo Swiss",
  category: "minimal",
  blurb: "Strict grid, red rules, oversized slide numerals. International Typographic Style.",
  defaultPalette: "ink",
  palettes: ["ink", "slate", "amber", "mono"],
  needs: ["kicker", "body", "bullets", "stat"],
  brief:
    "Terse, factual, confident. Titles are noun phrases or short statements. No exclamation marks. One supporting sentence maximum.",
  slideRange: [8, 10],
  pad: 88,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const colW = cb.w / 12;
    // Grid rule set
    nodes.push({ kind: "rect", x: 0, y: 0, w: c.w, h: 14, fill: c.pal.accent });
    for (let i = 1; i < 12; i += 1) {
      nodes.push({
        kind: "line",
        x1: cb.x + colW * i,
        y1: 0,
        x2: cb.x + colW * i,
        y2: c.h,
        stroke: withAlpha(c.pal.fg, 0.05),
        lineWidth: 1,
      });
    }
    const numSize = 190;
    nodes.push(
      fixedBlock(c, String(c.index + 1).padStart(2, "0"), {
        x: cb.x + cb.w - 260,
        y: c.pad - 10,
        w: 260,
        size: numSize,
        font: c.fonts.sans,
        weight: 800,
        color: withAlpha(c.pal.fg, 0.08),
        align: "right",
        lineHeight: 1,
        letterSpacing: -8,
        marks: {},
      }).node,
    );
    const s = defaultShell(c, {
      align: "left",
      justify: "end",
      titleMax: 104,
      titleMin: 40,
      titleLH: 0.98,
      titleLS: -3.5,
      titleWeight: 800,
      bodySize: 30,
      bodyLH: 1.45,
      kickerSize: 21,
      kickerLS: 4,
      kickerColor: c.pal.accent,
      bullet: "square",
      gap: 30,
    });
    const box = { x: cb.x, y: cb.y + 120, w: colW * 10, h: cb.h - 200 };
    nodes.push(...composeStack(c, s, box));
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: c.h - c.pad - 6,
      x2: cb.x + cb.w,
      y2: c.h - c.pad - 6,
      stroke: c.pal.accent,
      lineWidth: 4,
    });
    nodes.push(...D.footer(c, { color: c.pal.fg, y: c.h - c.pad + 16 }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 04 · Duotone ---------------------------- */

export const duotone: Preset = {
  id: "duotone",
  name: "Duotone",
  category: "minimal",
  blurb: "Two colours, a giant ghost numeral, and almost nothing else.",
  defaultPalette: "electric",
  palettes: ["electric", "amber", "candy", "forest", "sunset", "midnight"],
  needs: ["kicker", "body"],
  brief:
    "Extremely economical. Titles 3–8 words. Body one short sentence or omitted entirely. Every slide should feel like a poster.",
  slideRange: [7, 9],
  pad: 100,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const ghost = String(c.index + 1);
    const gs = 640;
    // Sits low and centred so it never fights the kicker for legibility.
    nodes.push(
      fixedBlock(c, ghost, {
        x: c.w / 2 - gs,
        y: c.h * 0.60 - gs * 0.5,
        w: gs * 2,
        size: gs,
        font: c.fonts.sans,
        weight: 800,
        color: withAlpha(c.pal.accent, 0.11),
        align: "center",
        lineHeight: 1,
        letterSpacing: -30,
        marks: {},
      }).node,
    );
    const s = defaultShell(c, {
      align: "center",
      justify: "center",
      titleMax: 108,
      titleMin: 42,
      titleLH: 1.04,
      titleLS: -2.5,
      titleWeight: 800,
      bodySize: 30,
      bodyLH: 1.45,
      bodyColor: mix(c.pal.muted, c.pal.fg, 0.35),
      kickerSize: 22,
      kickerLS: 5,
      kickerColor: c.pal.accent,
      bullet: "none",
      gap: 30,
    });
    nodes.push(...composeStack(c, s, { x: cb.x, y: cb.y, w: cb.w, h: cb.h - 90 }));
    nodes.push(...D.footer(c, { showSwipe: c.index < c.total - 1 }));
    nodes.push(D.grain(c, 0.04));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 05 · Quote ----------------------------- */

export const quoteCard: Preset = {
  id: "quote",
  name: "Quote Card",
  category: "editorial",
  blurb: "Oversized quotation mark, serif line, attribution bar. Built for saves.",
  defaultPalette: "paper",
  palettes: ["paper", "cream", "midnight", "clay", "sunset"],
  needs: ["kicker", "quote", "body", "note"],
  brief:
    "Every body slide carries a `quote` — a sharp, quotable line of 8–24 words in the deck's voice, attributed to the author (use the handle) unless a real named source is cited. Titles are short framing labels.",
  slideRange: [7, 9],
  pad: 96,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const isCover = c.slide.role === "cover";
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "serif",
      titleWeight: 400,
      titleMax: isCover ? 110 : 62,
      titleMin: 34,
      titleLH: 1.1,
      bodySize: 28,
      bodyLH: 1.5,
      kickerSize: 21,
      kickerLS: 4,
      gap: 28,
    });
    if (!isCover && c.slide.quote) {
      nodes.push(D.quoteGlyph(c, cb.x - 12, cb.y + 4, 210, withAlpha(c.pal.accent, 0.28)));
    }
    const box = { x: cb.x, y: cb.y + (isCover ? 0 : 120), w: cb.w, h: cb.h - (isCover ? 110 : 230) };
    nodes.push(
      ...layoutParts(
        [kickerPart(c, s, box), titlePart(c, s, box), quotePart(c, s, box), bodyPart(c, s, box), notePart(c, s, box)],
        box,
        s.gap,
        s.justify,
      ),
    );
    nodes.push({
      kind: "rect",
      x: 0,
      y: c.h - 86,
      w: c.w,
      h: 86,
      fill: c.pal.fg,
    });
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - 86 + 28,
        w: cb.w / 2,
        size: 26,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.bg,
        marks: {},
      }).node,
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x + cb.w - 120,
        y: c.h - 86 + 28,
        w: 120,
        size: 26,
        font: c.fonts.mono,
        weight: 600,
        color: withAlpha(c.pal.bg, 0.7),
        align: "right",
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.05, c.pal.dark ? "#ffffff" : "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};
