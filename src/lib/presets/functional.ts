import type { Box, Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import { dataTable, rankRows, tableHeight } from "../render/diagrams";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  coverScene,
  defaultShell,
  featurePart,
  headStack,
  itemsPart,
  scene,
  statPart,
  stepsPart,
  type ShellStyle,
} from "./_shared";
import type { Preset } from "./types";

/* --------------------------- shared helpers --------------------------- */

/**
 * Small print above the footer, plus the vertical space it needs reserved.
 * Presets in this set treat `note` as an optional caption on the data block,
 * so this keeps the diagram from colliding with it.
 */
function noteReserve(c: Ctx): number {
  return c.slide.note ? 150 : 92;
}

function drawNote(c: Ctx, cb: Box, o?: { mono?: boolean }): Node[] {
  if (!c.slide.note) return [];
  return [
    fixedBlock(c, c.slide.note, {
      x: cb.x,
      y: c.h - c.pad - 118,
      w: cb.w,
      size: 21,
      font: o?.mono ? c.fonts.mono : c.fonts.sans,
      weight: 500,
      color: withAlpha(c.pal.muted, 0.95),
      align: "center",
      lineHeight: 1.32,
      marks: c.marks,
    }).node,
  ];
}

/** A compact kicker → title → body header that never eats the whole slide. */
function header(c: Ctx, s: ShellStyle, cb: Box, titleMaxFrac = 0.26): { nodes: Node[]; y: number } {
  const h = headStack(c, s, cb, {
    titleMaxH: cb.h * titleMaxFrac,
    gap: 14,
    skipBody: !c.slide.body,
  });
  return { nodes: h.nodes, y: h.bottom };
}

/* ------------------------------ 1 · Ledger ---------------------------- */

const ledger: Preset = {
  id: "ledger",
  name: "Ledger",
  category: "data",
  blurb: "A clean bordered data table — header rule, mono figures, hairline rows.",
  defaultPalette: "slate",
  palettes: ["slate", "paper", "blueprint", "mono"],
  needs: ["kicker", "body", "table", "items", "note"],
  brief:
    "Spreadsheet clarity. Give every body slide a `table` with 2–4 short column headers and 3–6 rows of terse cells (figures, one or two words), or an `items` list of label → value pairs. Keep the first column a label and the rest tight, comparable figures — the layout aligns and rules them like a ledger.",
  slideRange: [6, 10],
  pad: 84,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.gridLines(c, 108, withAlpha(c.pal.fg, c.pal.dark ? 0.05 : 0.04)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 62,
      titleMin: 30,
      titleLH: 1.06,
      titleLS: -1.4,
      bodySize: 24,
      bodyLH: 1.4,
      kickerSize: 21,
      kickerLS: 3,
    });
    const head = header(c, s, cb, 0.24);
    nodes.push(...head.nodes);

    // Header rule — the ledger's top border.
    let y = head.y + 18;
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: y,
      x2: cb.x + cb.w,
      y2: y,
      stroke: withAlpha(c.pal.fg, 0.3),
      lineWidth: 2,
    });
    y += 26;

    const footH = noteReserve(c);
    const zoneH = Math.max(180, c.h - c.pad - footH - y);
    const zone: Box = { x: cb.x, y, w: cb.w, h: zoneH };

    const table = c.slide.table;
    if (table && table.columns.length && table.rows.length) {
      const drawn = tableHeight(c, zone, table);
      const off = Math.max(0, (zoneH - drawn) / 2);
      nodes.push(
        ...dataTable(c, { ...zone, y: y + off }, table, {
          font: c.fonts.mono,
          headFill: c.pal.accent,
          radius: 12,
        }),
      );
    } else {
      const part = itemsPart(c, s, zone, { mono: true }) ?? featurePart(c, s, zone);
      if (part) nodes.push(...part.draw(y + Math.max(0, (zoneH - part.h) / 2)));
    }

    nodes.push(...drawNote(c, cb, { mono: true }));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 2 · Podium ---------------------------- */

const podium: Preset = {
  id: "podium",
  name: "Podium",
  category: "bold",
  blurb: "A ranked leaderboard — big rank numbers, labels, values hard right.",
  defaultPalette: "midnight",
  palettes: ["midnight", "electric", "amber", "forest"],
  needs: ["kicker", "ranked", "stat", "note"],
  brief:
    "The leaderboard. Give every body slide a `ranked` list of 3–6 entries, each a short `label` (2–4 words) and a `value` that is a comparable figure ('92%', 'US$ 4.8B', '4.9★'); an optional `note` adds a one-line gloss under the label. Order them best-to-worst — the ranking is the whole point. A headline `stat` can crown the board with the metric being ranked.",
  slideRange: [6, 10],
  pad: 88,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 68,
      titleMin: 32,
      titleLH: 1.05,
      titleLS: -1.8,
      bodySize: 25,
      kickerSize: 21,
      kickerLS: 3,
    });
    const head = header(c, s, cb, 0.24);
    nodes.push(...head.nodes);
    let y = head.y + 14;

    // The metric being ranked, crowning the board.
    const st = c.slide.stat;
    if (st && st.value) {
      nodes.push(
        fixedBlock(c, `${st.label} · ${st.value}`, {
          x: cb.x,
          y,
          w: cb.w,
          size: 22,
          font: c.fonts.mono,
          weight: 600,
          color: c.pal.accent,
          letterSpacing: 0.5,
          lineHeight: 1.3,
          marks: {},
        }).node,
      );
      y += 40;
    }

    const footH = noteReserve(c);
    const zoneH = Math.max(220, c.h - c.pad - footH - y);
    const zone: Box = { x: cb.x, y, w: cb.w, h: zoneH };

    const ranked = c.slide.ranked;
    if (ranked && ranked.length) {
      nodes.push(...rankRows(c, zone, ranked, { valueColor: c.pal.accent }));
    } else {
      const stat = statPart(c, s, zone, { big: 240, valueColor: c.pal.accent });
      const part = stat ?? featurePart(c, s, zone);
      if (part) nodes.push(...part.draw(y + Math.max(0, (zoneH - part.h) / 2)));
    }

    nodes.push(...drawNote(c, cb));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 3 · Versus ---------------------------- */

const versus: Preset = {
  id: "versus",
  name: "Versus",
  category: "bold",
  blurb: "Head-to-head: two colour-coded columns split by a central VS.",
  defaultPalette: "ink",
  palettes: ["ink", "midnight", "electric", "slate"],
  needs: ["kicker", "body", "compare", "note"],
  brief:
    "A bold face-off. Every body slide carries `compare` with two labelled sides (e.g. 'OLD WAY' vs 'NEW WAY') and 3–4 short items each — phrases, never sentences. The left reads as the loser, the right as the winner; write the pairs so the contrast lands at a glance.",
  slideRange: [6, 9],
  pad: 84,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 66,
      titleMin: 32,
      titleLH: 1.05,
      titleLS: -1.8,
      bodySize: 25,
      bodyLH: 1.38,
      kickerSize: 21,
      kickerLS: 3,
    });
    const head = header(c, s, cb, 0.24);
    nodes.push(...head.nodes);
    const y = head.y + 20;

    const footH = noteReserve(c);
    const zoneH = Math.max(260, c.h - c.pad - footH - y);
    const cmp = c.slide.compare;

    if (cmp) {
      const gutter = 64;
      const colW = (cb.w - gutter) / 2;
      const bad = "#ff4d4f";
      const good = c.pal.accent2 === c.pal.accent ? "#22c55e" : c.pal.accent2;
      const sides = [
        { label: cmp.leftLabel, items: cmp.leftItems ?? [], color: bad, x: cb.x, win: false },
        { label: cmp.rightLabel, items: cmp.rightItems ?? [], color: good, x: cb.x + colW + gutter, win: true },
      ] as const;
      const maxItems = Math.max(1, cmp.leftItems?.length ?? 0, cmp.rightItems?.length ?? 0);

      for (const side of sides) {
        // Colour-coded panel.
        nodes.push({
          kind: "rect",
          x: side.x,
          y,
          w: colW,
          h: zoneH,
          r: 22,
          fill: withAlpha(side.color, c.pal.dark ? 0.14 : 0.09),
          stroke: withAlpha(side.color, 0.55),
          lineWidth: 2.5,
        });
        // Strong label header band.
        nodes.push({
          kind: "rect",
          x: side.x,
          y,
          w: colW,
          h: 66,
          r: [22, 22, 0, 0],
          fill: withAlpha(side.color, 0.22),
        });
        nodes.push(
          fixedBlock(c, side.label, {
            x: side.x + 22,
            y: y + 20,
            w: colW - 44,
            size: 25,
            font: c.fonts.sans,
            weight: 800,
            color: side.color,
            letterSpacing: 1.5,
            uppercase: true,
            lineHeight: 1.1,
            marks: {},
          }).node,
        );

        const itemSize = Math.max(19, Math.min(28, (zoneH - 96) / maxItems / 2.3));
        let iy = y + 90;
        for (const item of side.items) {
          const b = fixedBlock(c, item, {
            x: side.x + 58,
            y: iy,
            w: colW - 78,
            size: itemSize,
            font: c.fonts.sans,
            weight: 600,
            color: c.pal.fg,
            lineHeight: 1.28,
            marks: {},
          });
          const midY = iy + itemSize * 0.64;
          nodes.push(
            side.win
              ? {
                  kind: "path",
                  d: `M ${side.x + 24} ${midY} L ${side.x + 33} ${midY + 10} L ${side.x + 48} ${midY - 12}`,
                  stroke: side.color,
                  lineWidth: 4,
                  cap: "round",
                  join: "round",
                }
              : {
                  kind: "path",
                  d: `M ${side.x + 26} ${midY - 10} L ${side.x + 46} ${midY + 10} M ${side.x + 46} ${midY - 10} L ${side.x + 26} ${midY + 10}`,
                  stroke: side.color,
                  lineWidth: 4,
                  cap: "round",
                },
            b.node,
          );
          iy += b.height + 20;
        }
      }

      // Central VS medallion on the seam.
      const seamX = cb.x + colW + gutter / 2;
      const seamY = y + zoneH / 2;
      const vr = 40;
      nodes.push({
        kind: "ellipse",
        cx: seamX,
        cy: seamY,
        rx: vr,
        ry: vr,
        fill: c.pal.fg,
        stroke: c.pal.bg,
        lineWidth: 6,
      });
      const vsW = textWidth(c, "VS", c.fonts.sans, 30, 800, 1);
      nodes.push(
        fixedBlock(c, "VS", {
          x: seamX - vsW / 2,
          y: seamY - 30 * 0.64,
          w: vsW + 8,
          size: 30,
          font: c.fonts.sans,
          weight: 800,
          color: c.pal.bg,
          letterSpacing: 1,
          marks: {},
        }).node,
      );
    } else {
      const part = featurePart(c, s, { x: cb.x, y, w: cb.w, h: zoneH });
      if (part) nodes.push(...part.draw(y + Math.max(0, (zoneH - part.h) / 2)));
    }

    nodes.push(...drawNote(c, cb));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 4 · Roadmap ---------------------------- */

const roadmap: Preset = {
  id: "roadmap",
  name: "Roadmap",
  category: "technical",
  blurb: "A connected numbered path — station nodes wired stage to stage.",
  defaultPalette: "blueprint",
  palettes: ["blueprint", "terminal", "slate", "forest"],
  needs: ["kicker", "body", "steps", "note"],
  brief:
    "A process laid out as a route. Every body slide carries `steps`: 3–5 stages in order, each a short `label` (2–5 words) and a `text` of one clause explaining it. Write them as a progression — each station should read as the next stop after the last.",
  slideRange: [6, 9],
  pad: 92,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.dotGrid(c, 58, 2, withAlpha(c.pal.fg, c.pal.dark ? 0.08 : 0.06)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 66,
      titleMin: 32,
      titleLH: 1.05,
      titleLS: -1.8,
      bodySize: 25,
      bodyLH: 1.4,
      kickerSize: 21,
      kickerLS: 3,
    });
    const head = header(c, s, cb, 0.26);
    nodes.push(...head.nodes);
    const y = head.y + 22;

    const footH = noteReserve(c);
    const zoneH = Math.max(240, c.h - c.pad - footH - y);
    const zone: Box = { x: cb.x, y, w: cb.w, h: zoneH };

    const steps = c.slide.steps;
    const part = stepsPart(c, s, zone);
    if (steps && steps.length && part) {
      const partY = y + Math.max(0, (zoneH - part.h) / 2);
      // A solid rail behind the station badges, so the stops read as one route.
      const r = Math.min(38, zone.w / (steps.length * 3.4));
      const railX = zone.x + r;
      nodes.push({
        kind: "line",
        x1: railX,
        y1: partY + r * 0.72,
        x2: railX,
        y2: partY + part.h - r * 0.72,
        stroke: withAlpha(c.pal.accent, 0.28),
        lineWidth: 4,
        cap: "round",
      });
      nodes.push(...part.draw(partY));
    } else {
      const fb = featurePart(c, s, zone);
      if (fb) nodes.push(...fb.draw(y + Math.max(0, (zoneH - fb.h) / 2)));
    }

    nodes.push(...drawNote(c, cb));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

export const FUNCTIONAL_PRESETS: Preset[] = [ledger, podium, versus, roadmap];
