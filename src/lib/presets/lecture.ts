import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock } from "../render/ctx";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyBox,
  bulletsPart,
  defaultShell,
  headStack,
  itemsPart,
  scene,
  statPart,
  stepsPart,
  D,
} from "./_shared";
import * as Do from "./_doodles";
import type { Preset } from "./types";
import type { MarkTheme } from "../render/text";

/**
 * "Lecture" — a white-ground academic whiteboard explainer: a heavy headline
 * with one keyword popped in green, the substance as green diagram furniture
 * (numbered steps, a figure, a labelled list), a green highlight-bar takeaway,
 * hand-drawn corner brackets and a category-tag footer. It is the format that
 * teaches a concept in a carousel. Zero image models — the reference's cutout
 * portrait is replaced by an initials medallion with a green rim, and every
 * chart/diagram is vectors.
 */

/** Green marks so **bold** words in the copy pop in the accent. */
function greenMarks(c: Ctx): MarkTheme {
  return {
    accent: { color: c.pal.accent, weight: 900 },
    highlight: { highlight: withAlpha(c.pal.accent, 0.28) },
    underline: { underline: c.pal.accent },
    strike: { strike: c.pal.muted, color: c.pal.muted },
  };
}

/** Hand-drawn L brackets at the four corners of a box — the whiteboard frame. */
function brackets(c: Ctx, b: Box, color: string, len = 46, w = 5): Node[] {
  const out: Node[] = [];
  const corners: [number, number, number, number][] = [
    [b.x, b.y, 1, 1],
    [b.x + b.w, b.y, -1, 1],
    [b.x, b.y + b.h, 1, -1],
    [b.x + b.w, b.y + b.h, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    out.push({ kind: "path", d: D.sketchLine(c, [[x, y], [x + len * sx, y]], 3), stroke: color, lineWidth: w, cap: "round" });
    out.push({ kind: "path", d: D.sketchLine(c, [[x, y], [x, y + len * sy]], 3), stroke: color, lineWidth: w, cap: "round" });
  }
  return out;
}

/** A small "figure" medallion — initials with a green rim, standing in for a portrait. */
function figure(c: Ctx, cx: number, cy: number, r: number, green: string): Node[] {
  return [
    { kind: "ellipse", cx, cy, rx: r + 8, ry: r + 8, fill: withAlpha(green, 0.16) },
    { kind: "ellipse", cx, cy, rx: r + 3, ry: r + 3, stroke: green, lineWidth: 5 },
    ...D.avatar(c, c.deck.handle || "Author", cx, cy, r, { fill: c.pal.surface, color: green }),
  ];
}

export const lecture: Preset = {
  id: "lecture",
  name: "Lecture",
  category: "data",
  blurb: "Green whiteboard explainer — heavy headline with a keyword pop, sketch diagrams, a takeaway bar and tag footer.",
  defaultPalette: "whiteboard",
  palettes: ["whiteboard", "paper", "mono", "cream"],
  needs: ["kicker", "body", "steps", "stat", "items", "bullets", "note"],
  brief:
    "A teach-a-concept explainer. A heavy headline (3-8 words) with one or two key words wrapped in **bold** so they pop green, a one-line setup, then the substance as structure: `steps` for the walk-through, a `stat` for the figure, `items` or `bullets` for the parts. A `note` becomes the green takeaway bar. Clear and a little witty, like a good lecturer.",
  slideRange: [6, 12],
  pad: 88,
  render(c) {
    const nodes: Node[] = [];
    const green = c.pal.accent;
    const ink = c.pal.fg;
    const marks = greenMarks(c);
    nodes.push({ kind: "rect", x: 0, y: 0, w: c.w, h: c.h, fill: c.pal.bg });

    const cb = contentBox(c);

    // Handle, top-left.
    if (c.deck.handle?.trim()) {
      nodes.push(
        fixedBlock(c, c.deck.handle.trim(), {
          x: cb.x, y: cb.y - 8, w: cb.w * 0.6, size: 22, font: c.fonts.mono, weight: 600,
          color: withAlpha(ink, 0.55), letterSpacing: 1, marks: {},
        }).node,
      );
    }

    const box = bodyBox(c, 118);
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 16,
      marks,
      kickerFont: "mono",
      kickerWeight: 700,
      kickerSize: 22,
      kickerLS: 3,
      kickerUpper: true,
      kickerColor: green,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 100,
      titleMin: 42,
      titleLH: 1.0,
      titleLS: -1.5,
      titleColor: ink,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: withAlpha(ink, 0.7),
      bullet: "number",
      bulletColor: green,
      bulletGap: 22,
    });

    // Header (kicker + heavy title + setup line) below the handle.
    const header: Box = { x: box.x, y: box.y + 40, w: box.w, h: box.h - 40 };
    const head = headStack(c, s, header, { titleMaxH: header.h * 0.34, gap: 14 });
    nodes.push(...head.nodes);

    // Takeaway bar reserved at the bottom when a note exists.
    const hasNote = !!c.slide.note?.trim();
    const barH = hasNote ? 108 : 0;
    const regionBottom = box.y + box.h - (hasNote ? barH + 30 : 0);
    const region: Box = { x: box.x, y: head.bottom + 26, w: box.w, h: Math.max(0, regionBottom - (head.bottom + 26)) };

    // Diagram furniture: steps / stat / list — all render green via the palette.
    if (region.h > 120) {
      const hero = stepsPart(c, s, region) ?? statPart(c, s, region) ?? itemsPart(c, s, region) ?? bulletsPart(c, s, region);
      if (hero) {
        nodes.push(...hero.draw(region.y));
      } else {
        // A hook / concept slide: a hand-drawn sketch (a bending curve + tangent
        // + labels) and the figure medallion — the whiteboard hero.
        const dcx = region.x + region.w * 0.28;
        const dcy = region.y + region.h * 0.52;
        const dw = region.w * 0.5;
        // bending curve
        const pts: [number, number][] = [];
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          pts.push([dcx - dw / 2 + t * dw, dcy + Math.cos(t * Math.PI) * region.h * 0.16 - region.h * 0.02]);
        }
        nodes.push({ kind: "path", d: D.sketchLine(c, pts, 4), stroke: green, lineWidth: 5, cap: "round" });
        // tangent line at the middle
        nodes.push({ kind: "path", d: D.sketchLine(c, [[dcx - dw * 0.28, dcy - region.h * 0.06], [dcx + dw * 0.34, dcy - region.h * 0.02]], 3), stroke: withAlpha(ink, 0.5), lineWidth: 3, dash: [10, 8] });
        nodes.push(Do.handLabel(c, "just a line, up close", dcx - dw * 0.2, dcy + region.h * 0.14, 30, withAlpha(ink, 0.7)));
        nodes.push(...D.curvedArrow([dcx + dw * 0.1, dcy + region.h * 0.1], [dcx + dw * 0.05, dcy], 26, withAlpha(green, 0.9), 4));
        // figure medallion, right side
        const fr = Math.min(region.w * 0.16, region.h * 0.32, 130);
        figure(c, region.x + region.w - fr - 10, region.y + region.h * 0.5, fr, green).forEach((n) => nodes.push(n));
      }
    }

    // Green takeaway bar (the note).
    if (hasNote) {
      const barY = box.y + box.h - barH;
      nodes.push({ kind: "rect", x: box.x, y: barY, w: box.w, h: barH, r: 18, fill: withAlpha(green, 0.12), stroke: withAlpha(green, 0.4), lineWidth: 2 });
      const icx = box.x + 44;
      const icy = barY + barH / 2;
      nodes.push(
        { kind: "ellipse", cx: icx, cy: icy, rx: 22, ry: 22, fill: green },
        { kind: "path", d: `M ${icx - 9} ${icy} L ${icx - 2} ${icy + 8} L ${icx + 11} ${icy - 9}`, stroke: c.pal.surface, lineWidth: 4.5, cap: "round", join: "round" },
      );
      const tb = block(c, c.slide.note!.trim(), {
        x: box.x + 88, y: 0, w: box.w - 120, maxH: barH - 28, font: c.fonts.sans, weight: 700, max: 34, min: 20, lineHeight: 1.18, align: "left", color: ink, marks,
      });
      nodes.push({ ...tb.node, y: barY + (barH - tb.height) / 2 });
    }

    // Hand-drawn corner brackets around the whole content — the whiteboard frame.
    nodes.push(...brackets(c, { x: cb.x - 10, y: cb.y + 30, w: cb.w + 20, h: cb.h - 40 }, withAlpha(ink, 0.5), 48, 5));

    // Footer: category tags from the hashtags (or handle).
    const tags = c.deck.hashtags?.length
      ? c.deck.hashtags.slice(0, 4).map((h) => h.replace(/^#/, "").toUpperCase()).join("   ·   ")
      : "";
    if (tags) {
      nodes.push(
        fixedBlock(c, tags, {
          x: cb.x, y: c.h - c.pad + 20, w: cb.w * 0.8, size: 18, font: c.fonts.mono, weight: 600,
          color: withAlpha(ink, 0.5), letterSpacing: 1.5, marks: {},
        }).node,
      );
    }
    nodes.push(...D.progressDots(c, cb.x + cb.w - (c.total - 1) * 15 - 6, c.h - c.pad + 30, 15, 4));

    return scene(c, c.pal.bg, nodes);
  },
};
