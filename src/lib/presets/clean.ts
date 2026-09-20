import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  bulletsPart,
  chatPart,
  comparePart,
  coverScene,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  statPart,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* --------------------------- 21 · Studio Minimal ------------------------ */

export const compare: Preset = {
  id: "compare",
  name: "Compare",
  category: "data",
  blurb: "Hard split: the wrong way on the left, the right way on the right.",
  defaultPalette: "ink",
  palettes: ["ink", "slate", "midnight", "notebook"],
  needs: ["kicker", "body", "compare", "note"],
  brief:
    "Contrast-driven. Every body slide carries `compare` with two labelled columns (e.g. 'MOST PEOPLE' vs 'DO THIS INSTEAD') and 3–4 short items each. Items are phrases, never sentences.",
  slideRange: [7, 9],
  pad: 84,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const cmp = c.slide.compare;

    let y = cb.y;
    const s = defaultShell(c, {
      align: "left",
      titleMax: 66,
      titleMin: 34,
      titleLH: 1.06,
      titleLS: -1.8,
      bodySize: 26,
      bodyLH: 1.4,
      kickerSize: 21,
      kickerLS: 3,
      gap: 22,
    });
    for (const part of [kickerPart(c, s, { ...cb, y }), titlePart(c, s, { ...cb, y }, undefined, cb.h * 0.28), bodyPart(c, s, { ...cb, y })]) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 16;

    const footH = c.slide.note ? 110 : 66;
    const zoneH = c.h - c.pad - footH - y;
    if (cmp) {
      const colW = (cb.w - 30) / 2;
      const bad = "#ff4d4f";
      const good = c.pal.accent2 === c.pal.accent ? "#22c55e" : c.pal.accent2;
      ([
        [cmp.leftLabel, cmp.leftItems, bad, cb.x, false],
        [cmp.rightLabel, cmp.rightItems, good, cb.x + colW + 30, true],
      ] as const).forEach(([label, items, color, x, isGood]) => {
        nodes.push({
          kind: "rect",
          x,
          y,
          w: colW,
          h: zoneH,
          r: 20,
          fill: withAlpha(color, 0.08),
          stroke: withAlpha(color, 0.4),
          lineWidth: 2,
        });
        nodes.push(
          fixedBlock(c, label, {
            x: x + 24,
            y: y + 26,
            w: colW - 48,
            size: 23,
            font: c.fonts.sans,
            weight: 800,
            color,
            letterSpacing: 2,
            uppercase: true,
            lineHeight: 1.15,
            marks: {},
          }).node,
        );
        nodes.push({ kind: "line", x1: x + 24, y1: y + 74, x2: x + colW - 24, y2: y + 74, stroke: withAlpha(color, 0.35), lineWidth: 1.5 });
        let iy = y + 100;
        const size = Math.max(20, Math.min(26, (zoneH - 130) / Math.max(1, items.length) / 2.4));
        for (const item of items) {
          const b = fixedBlock(c, item, {
            x: x + 62,
            y: iy,
            w: colW - 86,
            size,
            font: c.fonts.sans,
            weight: 500,
            color: c.pal.fg,
            lineHeight: 1.3,
            marks: {},
          });
          const midY = iy + size * 0.66;
          nodes.push(
            isGood
              ? {
                  kind: "path",
                  d: `M ${x + 26} ${midY} L ${x + 34} ${midY + 9} L ${x + 48} ${midY - 11}`,
                  stroke: color,
                  lineWidth: 3.5,
                  cap: "round",
                  join: "round",
                }
              : {
                  kind: "path",
                  d: `M ${x + 28} ${midY - 9} L ${x + 46} ${midY + 9} M ${x + 46} ${midY - 9} L ${x + 28} ${midY + 9}`,
                  stroke: color,
                  lineWidth: 3.5,
                  cap: "round",
                },
            b.node,
          );
          iy += b.height + 22;
        }
      });
      // VS badge on the seam.
      const vs = D.chip(c, "VS", {
        x: cb.x + colW + 15 - 30,
        y: y + zoneH / 2 - 22,
        size: 20,
        fill: c.pal.fg,
        color: c.pal.bg,
        letterSpacing: 1,
        padX: 16,
      });
      nodes.push(...vs.nodes);
    } else {
      const f = featurePart(c, s, { x: cb.x, y, w: cb.w, h: zoneH });
      if (f) nodes.push(...f.draw(y));
    }

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 92,
          w: cb.w,
          size: 24,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          align: "center",
          marks: {
            accent: { color: c.pal.accent, weight: 800 },
            highlight: { highlight: withAlpha(c.pal.accent, 0.25) },
            underline: { underline: c.pal.accent },
            strike: { strike: c.pal.muted, color: c.pal.muted },
          },
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 24 · Data Card ---------------------------- */

export const datacard: Preset = {
  id: "datacard",
  name: "Data Card",
  category: "data",
  blurb: "One number, enormous, with a delta chip and a supporting chart.",
  defaultPalette: "midnight",
  palettes: ["midnight", "electric", "forest", "slate", "terminal"],
  needs: ["kicker", "body", "stat", "note"],
  brief:
    "Number-led. Every body slide carries a `stat`: `value` is short and typographic ('3.2×', '$4,800', '71%'), `label` explains it in under 10 words, and `delta` is an optional signed change. Only use figures you can stand behind.",
  slideRange: [7, 9],
  pad: 92,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.gridLines(c, 90, withAlpha(c.pal.fg, 0.05)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 58,
      titleMin: 32,
      titleLH: 1.08,
      titleLS: -1.6,
      bodySize: 26,
      bodyLH: 1.42,
      kickerSize: 21,
      kickerLS: 3,
      gap: 20,
    });

    let y = cb.y;
    for (const part of [kickerPart(c, s, cb), titlePart(c, s, cb, undefined, cb.h * 0.24)]) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 20;

    const chartH = 260;
    const statZone = { x: cb.x, y, w: cb.w, h: c.h - c.pad - chartH - 60 - y };
    const stat = statPart(c, s, statZone, { big: 260, valueColor: c.pal.fg });
    if (stat) {
      nodes.push(...stat.draw(y + Math.max(0, (statZone.h - stat.h) / 2)));
    } else {
      const f = featurePart(c, s, statZone) ?? bodyPart(c, s, statZone);
      if (f) nodes.push(...f.draw(y));
    }

    // Supporting chart along the bottom.
    const cy = c.h - c.pad - chartH + 30;
    const vals = Array.from({ length: 7 }, (_, i) => 3 + i * 1.4 + c.rand() * 2.4);
    nodes.push(
      ...D.sparkline(c, { x: cb.x, y: cy, w: cb.w, h: chartH - 110 }, vals, {
        color: c.pal.accent,
        fill: true,
        width: 5,
      }),
    );
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: cy + chartH - 106,
      x2: cb.x + cb.w,
      y2: cy + chartH - 106,
      stroke: withAlpha(c.pal.fg, 0.18),
      lineWidth: 1.5,
    });
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: cy + chartH - 92,
          w: cb.w,
          size: 21,
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

/* ---------------------------- 25 · Chat Thread -------------------------- */

