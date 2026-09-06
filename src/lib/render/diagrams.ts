import { mix, withAlpha } from "../theme";
import type { SlidePanel, SlideRanked, SlideTable } from "../types";
import type { Box, Ctx } from "./ctx";
import { fixedBlock, textWidth } from "./ctx";
import * as D from "./decor";
import { iconFor } from "./icons";
import * as P from "./props";
import type { Node, Paint } from "./scene";

/* ------------------------------- table -------------------------------- */

export interface TableOptions {
  headFill?: Paint;
  headColor?: string;
  zebra?: string;
  border?: string;
  color?: string;
  font?: string;
  radius?: number;
  /** Column weights; defaults to equal widths. */
  weights?: number[];
}

/** A real data grid: header row, zebra body rows, aligned columns. */
export function dataTable(c: Ctx, box: Box, table: SlideTable, o: TableOptions = {}): Node[] {
  const cols = table.columns.length || 1;
  const rows = table.rows.slice(0, 8);
  const border = o.border ?? withAlpha(c.pal.fg, 0.22);
  const font = o.font ?? c.fonts.sans;
  const radius = o.radius ?? 14;
  const headH = Math.min(96, box.h / (rows.length + 1.6));
  const rowH = Math.min(116, (box.h - headH) / Math.max(1, rows.length));
  const totalH = headH + rowH * rows.length;
  const size = Math.max(17, Math.min(25, rowH * 0.34));

  const weights = o.weights ?? Array(cols).fill(1);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const xs: number[] = [];
  let acc = box.x;
  for (let i = 0; i < cols; i++) {
    xs.push(acc);
    acc += (box.w * weights[i]) / wsum;
  }
  const colW = (i: number) => (box.w * weights[i]) / wsum;

  const out: Node[] = [
    { kind: "rect", x: box.x, y: box.y, w: box.w, h: totalH, r: radius, fill: withAlpha(c.pal.fg, 0.03) },
    {
      kind: "rect",
      x: box.x,
      y: box.y,
      w: box.w,
      h: headH,
      r: [radius, radius, 0, 0],
      fill: o.headFill ?? c.pal.accent,
    },
  ];

  table.columns.forEach((label, i) => {
    out.push(
      fixedBlock(c, label, {
        x: xs[i] + 14,
        y: box.y + headH / 2 - size * 0.62,
        w: colW(i) - 20,
        size,
        font,
        weight: 800,
        color: o.headColor ?? (c.pal.dark ? "#0b0b0c" : "#ffffff"),
        lineHeight: 1.1,
        letterSpacing: 0.5,
        uppercase: true,
        marks: {},
      }).node,
    );
  });

  rows.forEach((row, r) => {
    const ry = box.y + headH + r * rowH;
    if (r % 2 === 1) {
      out.push({
        kind: "rect",
        x: box.x,
        y: ry,
        w: box.w,
        h: rowH,
        fill: o.zebra ?? withAlpha(c.pal.fg, 0.05),
      });
    }
    out.push({
      kind: "line",
      x1: box.x,
      y1: ry,
      x2: box.x + box.w,
      y2: ry,
      stroke: border,
      lineWidth: 1,
    });
    for (let i = 0; i < cols; i++) {
      const cell = row[i] ?? "";
      if (!cell) continue;
      out.push(
        fixedBlock(c, cell, {
          x: xs[i] + 14,
          y: ry + rowH / 2 - size * 0.66,
          w: colW(i) - 20,
          size,
          font,
          weight: i === 0 ? 700 : 500,
          color: i === 0 ? (o.color ?? c.pal.fg) : withAlpha(o.color ?? c.pal.fg, 0.82),
          lineHeight: 1.15,
          marks: {},
        }).node,
      );
    }
  });

  // Column rules and outer frame last, so they sit above the zebra fills.
  for (let i = 1; i < cols; i++) {
    out.push({
      kind: "line",
      x1: xs[i],
      y1: box.y + headH,
      x2: xs[i],
      y2: box.y + totalH,
      stroke: border,
      lineWidth: 1,
    });
  }
  out.push({
    kind: "rect",
    x: box.x,
    y: box.y,
    w: box.w,
    h: totalH,
    r: radius,
    stroke: border,
    lineWidth: 2,
  });
  return out;
}

export function tableHeight(c: Ctx, box: Box, table: SlideTable): number {
  const rows = Math.min(8, table.rows.length);
  const headH = Math.min(96, box.h / (rows + 1.6));
  const rowH = Math.min(116, (box.h - headH) / Math.max(1, rows));
  return headH + rowH * rows;
}

/* ---------------------------- ranked rows ----------------------------- */

export interface RankOptions {
  showIcons?: boolean;
  badge?: string;
  badgeText?: string;
  valueColor?: string;
  gap?: number;
}

/** Rank badge · icon · label · big value. The most scannable list format. */
export function rankRows(c: Ctx, box: Box, ranked: SlideRanked[], o: RankOptions = {}): Node[] {
  const list = ranked.slice(0, 8);
  if (!list.length) return [];
  const gap = o.gap ?? 12;
  const rowH = Math.min(112, (box.h - gap * (list.length - 1)) / list.length);
  const r = Math.min(26, rowH * 0.26);
  const labelSize = Math.max(22, Math.min(34, rowH * 0.32));
  const valueSize = Math.max(26, Math.min(46, rowH * 0.42));
  const iconS = Math.min(52, rowH * 0.52);
  const out: Node[] = [];

  list.forEach((item, i) => {
    const y = box.y + i * (rowH + gap);
    const midY = y + rowH / 2;
    out.push({
      kind: "rect",
      x: box.x,
      y,
      w: box.w,
      h: rowH,
      r: 16,
      fill: withAlpha(c.pal.fg, 0.05),
    });
    out.push(...D.numberBadge(c, i + 1, box.x + r + 16, midY, r, {
      fill: o.badge ?? c.pal.accent,
      color: o.badgeText ?? (c.pal.dark ? "#0b0b0c" : "#ffffff"),
    }));

    let tx = box.x + r * 2 + 32;
    if (o.showIcons !== false) {
      const g = P.icon(iconFor(item.label), tx, midY - iconS / 2, iconS, c.pal.accent2, {
        width: Math.max(2.5, iconS * 0.075),
      });
      if (g) out.push(g);
      tx += iconS + 20;
    }

    const value = item.value?.trim();
    const vw = value ? textWidth(c, value, c.fonts.sans, valueSize, 800, -1) + 26 : 0;
    const labelBlock = fixedBlock(c, item.label, {
      x: tx,
      y: 0,
      w: box.w - (tx - box.x) - vw - 18,
      size: labelSize,
      font: c.fonts.sans,
      weight: 700,
      color: c.pal.fg,
      lineHeight: 1.14,
      uppercase: true,
      letterSpacing: 0.5,
      marks: {},
    });
    const noteBlock = item.note
      ? fixedBlock(c, item.note, {
          x: tx,
          y: 0,
          w: box.w - (tx - box.x) - vw - 18,
          size: labelSize * 0.68,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          lineHeight: 1.2,
          marks: {},
        })
      : null;
    const stackH = labelBlock.height + (noteBlock ? noteBlock.height + 4 : 0);
    out.push({ ...labelBlock.node, y: midY - stackH / 2 });
    if (noteBlock) out.push({ ...noteBlock.node, y: midY - stackH / 2 + labelBlock.height + 4 });

    if (value) {
      out.push(
        fixedBlock(c, value, {
          x: box.x + box.w - vw,
          y: midY - valueSize * 0.62,
          w: vw - 12,
          size: valueSize,
          font: c.fonts.sans,
          weight: 800,
          color: o.valueColor ?? c.pal.accent,
          align: "right",
          letterSpacing: -1,
          marks: {},
        }).node,
      );
    }
  });
  return out;
}

/* ------------------------------ pyramid ------------------------------- */

/** Tiered leaderboard: 1 on top, then widening rows. */
export function rankPyramid(c: Ctx, box: Box, ranked: SlideRanked[]): Node[] {
  const list = ranked.slice(0, 12);
  if (!list.length) return [];
  // Row sizes 1,2,3,4… until everything is placed.
  const tiers: SlideRanked[][] = [];
  let i = 0;
  let width = 1;
  while (i < list.length) {
    tiers.push(list.slice(i, i + width));
    i += width;
    width += 1;
  }
  const rowH = box.h / tiers.length;
  const out: Node[] = [];
  tiers.forEach((tier, t) => {
    const cellW = Math.min(box.w / Math.max(3, tier.length), box.w / 3.2);
    const totalW = cellW * tier.length;
    const startX = box.x + (box.w - totalW) / 2;
    const y = box.y + t * rowH;
    tier.forEach((item, k) => {
      const cx = startX + k * cellW + cellW / 2;
      const iconS = Math.min(cellW * 0.42, rowH * 0.4);
      const g = P.icon(iconFor(item.label), cx - iconS / 2, y + rowH * 0.06, iconS, c.pal.fg, {
        width: Math.max(2, iconS * 0.06),
      });
      if (g) out.push(g);
      const rank = tiers.slice(0, t).reduce((a, b) => a + b.length, 0) + k + 1;
      out.push(
        ...D.numberBadge(c, rank, cx - iconS / 2 - 6, y + rowH * 0.06 + 6, 15, {
          fill: c.pal.accent,
          color: c.pal.dark ? "#0b0b0c" : "#ffffff",
        }),
      );
      out.push(
        fixedBlock(c, item.label, {
          x: cx - cellW / 2 + 6,
          y: y + rowH * 0.06 + iconS + 10,
          w: cellW - 12,
          size: Math.max(16, Math.min(23, cellW * 0.13)),
          font: c.fonts.sans,
          weight: 700,
          color: c.pal.fg,
          align: "center",
          lineHeight: 1.12,
          marks: {},
        }).node,
      );
      if (item.value) {
        out.push(
          fixedBlock(c, item.value, {
            x: cx - cellW / 2 + 6,
            y: y + rowH * 0.06 + iconS + 34,
            w: cellW - 12,
            size: Math.max(14, Math.min(20, cellW * 0.11)),
            font: c.fonts.sans,
            weight: 500,
            color: c.pal.muted,
            align: "center",
            marks: {},
          }).node,
        );
      }
    });
  });
  return out;
}

/* ---------------------------- layer stack ----------------------------- */

/** Isometric numbered slabs — for models, tiers and hierarchies. */
export function layerStack(
  c: Ctx,
  box: Box,
  layers: { label: string; text?: string }[],
  o?: { skew?: number; color?: string },
): Node[] {
  const list = layers.slice(0, 8);
  if (!list.length) return [];
  const skew = o?.skew ?? 42;
  const gap = 10;
  const slabH = (box.h - gap * (list.length - 1)) / list.length;
  const faceH = slabH * 0.72;
  const bodyW = box.w - skew;
  const out: Node[] = [];

  list.forEach((layer, i) => {
    // Bottom layer drawn first so upper slabs overlap correctly.
    const idx = list.length - 1 - i;
    const y = box.y + idx * (slabH + gap);
    const x = box.x;
    const tint = mix(c.pal.accent, c.pal.bg, 0.15 + (i / Math.max(1, list.length)) * 0.5);
    // Top face (parallelogram) then front face.
    out.push({
      kind: "path",
      d: `M ${x} ${y + skew * 0.36} L ${x + skew} ${y} L ${x + skew + bodyW} ${y} L ${x + bodyW} ${y + skew * 0.36} Z`,
      fill: mix(tint, "#ffffff", 0.22),
      stroke: withAlpha(c.pal.fg, 0.35),
      lineWidth: 1.5,
    });
    out.push({
      kind: "rect",
      x,
      y: y + skew * 0.36,
      w: bodyW,
      h: faceH,
      fill: tint,
      stroke: withAlpha(c.pal.fg, 0.35),
      lineWidth: 1.5,
    });
    const size = Math.max(17, Math.min(26, faceH * 0.36));
    out.push(
      fixedBlock(c, `${list.length - idx}`, {
        x: x + 16,
        y: y + skew * 0.36 + faceH / 2 - size * 0.62,
        w: 40,
        size,
        font: c.fonts.mono,
        weight: 800,
        color: c.pal.accent,
        marks: {},
      }).node,
      fixedBlock(c, layer.label, {
        x: x + 60,
        y: y + skew * 0.36 + faceH / 2 - size * 0.66,
        w: bodyW * 0.42,
        size,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        uppercase: true,
        letterSpacing: 0.5,
        lineHeight: 1.1,
        marks: {},
      }).node,
    );
    if (layer.text) {
      out.push(
        fixedBlock(c, layer.text, {
          x: x + bodyW * 0.5,
          y: y + skew * 0.36 + faceH / 2 - size * 0.55,
          w: bodyW * 0.48 - 14,
          size: size * 0.82,
          font: c.fonts.sans,
          weight: 500,
          color: withAlpha(c.pal.fg, 0.75),
          lineHeight: 1.16,
          marks: {},
        }).node,
      );
    }
  });
  return out;
}

/* ------------------------------- panels ------------------------------- */

/**
 * How tall a panel needs to be for its items, so callers that lay panels out
 * themselves can stop them stretching to fill the slide.
 */
export function naturalPanelHeight(panels: SlidePanel[], min = 150): number {
  const maxItems = Math.max(1, ...panels.map((p) => Math.min(6, p.items.length)));
  return Math.max(min, 58 + maxItems * 36 + 18);
}

/** A grid of bordered, titled panels. */
export function panelGrid(
  c: Ctx,
  box: Box,
  panels: SlidePanel[],
  o?: { cols?: number; accent?: string; fill?: Paint; radius?: number },
): Node[] {
  const list = panels.slice(0, 6);
  if (!list.length) return [];
  const cols = o?.cols ?? (list.length <= 2 ? list.length : 2);
  const rows = Math.ceil(list.length / cols);
  const gx = 18;
  const gy = 18;
  const w = (box.w - gx * (cols - 1)) / cols;
  const avail = (box.h - gy * (rows - 1)) / rows;
  // Panels stop growing once their items fit — a two-item panel stretched to
  // half the slide reads as a mistake, not as breathing room.
  const h = Math.min(avail, naturalPanelHeight(list));
  const usedH = h * rows + gy * (rows - 1);
  const top = box.y + Math.max(0, (box.h - usedH) / 2);
  const out: Node[] = [];

  list.forEach((panel, i) => {
    const x = box.x + (i % cols) * (w + gx);
    const y = top + Math.floor(i / cols) * (h + gy);
    const accent = o?.accent ?? c.pal.accent;
    out.push({
      kind: "rect",
      x,
      y,
      w,
      h,
      r: o?.radius ?? 16,
      fill: o?.fill ?? withAlpha(c.pal.fg, 0.04),
      stroke: withAlpha(accent, 0.55),
      lineWidth: 2,
    });
    const titleSize = Math.max(17, Math.min(24, h * 0.13));
    out.push(
      { kind: "rect", x, y, w, h: titleSize * 2, r: [16, 16, 0, 0], fill: withAlpha(accent, 0.18) },
      fixedBlock(c, panel.title, {
        x: x + 14,
        y: y + titleSize * 0.5,
        w: w - 28,
        size: titleSize,
        font: c.fonts.sans,
        weight: 800,
        color: accent,
        uppercase: true,
        letterSpacing: 1,
        lineHeight: 1.1,
        marks: {},
      }).node,
    );
    const itemSize = Math.max(15, Math.min(21, h * 0.105));
    let iy = y + titleSize * 2 + 12;
    for (const item of panel.items.slice(0, 6)) {
      const b = fixedBlock(c, item, {
        x: x + 30,
        y: iy,
        w: w - 42,
        size: itemSize,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.fg,
        lineHeight: 1.2,
        marks: {},
      });
      if (iy + b.height > y + h - 6) break;
      out.push(
        { kind: "ellipse", cx: x + 18, cy: iy + itemSize * 0.6, rx: 3.5, ry: 3.5, fill: accent },
        b.node,
      );
      iy += b.height + 9;
    }
  });
  return out;
}

/* ------------------------------ node flow ----------------------------- */

/** Horizontal icon flow with arrows between the stages. */
export function nodeFlow(
  c: Ctx,
  box: Box,
  nodes: { label: string; text?: string }[],
  o?: { circle?: boolean; accent?: string; captions?: boolean },
): Node[] {
  const list = nodes.slice(0, 6);
  if (!list.length) return [];
  const accent = o?.accent ?? c.pal.accent;
  const step = box.w / list.length;
  const tile = Math.min(step * 0.62, box.h * 0.46);
  const out: Node[] = [];

  list.forEach((n, i) => {
    const cx = box.x + step * i + step / 2;
    const ty = box.y;
    if (o?.circle !== false) {
      out.push({
        kind: "ellipse",
        cx,
        cy: ty + tile / 2,
        rx: tile / 2,
        ry: tile / 2,
        fill: withAlpha(accent, 0.14),
        stroke: withAlpha(accent, 0.5),
        lineWidth: 2,
      });
    }
    const g = P.icon(iconFor(n.label), cx - tile * 0.28, ty + tile * 0.22, tile * 0.56, accent, {
      width: Math.max(2.5, tile * 0.05),
    });
    if (g) out.push(g);

    const labelSize = Math.max(16, Math.min(23, step * 0.13));
    out.push(
      fixedBlock(c, n.label, {
        x: cx - step / 2 + 6,
        y: ty + tile + 14,
        w: step - 12,
        size: labelSize,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        align: "center",
        uppercase: true,
        letterSpacing: 0.5,
        lineHeight: 1.1,
        marks: {},
      }).node,
    );
    if (o?.captions !== false && n.text) {
      out.push(
        fixedBlock(c, n.text, {
          x: cx - step / 2 + 8,
          y: ty + tile + 14 + labelSize * 1.4,
          w: step - 16,
          size: labelSize * 0.78,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          align: "center",
          lineHeight: 1.2,
          marks: {},
        }).node,
      );
    }
    if (i < list.length - 1) {
      out.push(D.arrow(cx + tile / 2 + 8, ty + tile / 2, step - tile - 16, withAlpha(c.pal.fg, 0.4), 2.5));
    }
  });
  return out;
}

/* ------------------------------- axis --------------------------------- */

/** A labelled scale: an arrow with evenly spaced, captioned nodes. */
export function axisScale(
  c: Ctx,
  box: Box,
  nodes: { label: string; text?: string }[],
  o?: { caption?: string; accent?: string },
): Node[] {
  const list = nodes.slice(0, 6);
  if (!list.length) return [];
  const accent = o?.accent ?? c.pal.accent;
  const out: Node[] = [];
  const axisY = box.y + box.h * 0.3;
  out.push(D.arrow(box.x, axisY, box.w, withAlpha(c.pal.fg, 0.55), 3));
  if (o?.caption) {
    out.push(
      fixedBlock(c, o.caption, {
        x: box.x,
        y: box.y,
        w: box.w,
        size: 20,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.muted,
        align: "center",
        uppercase: true,
        letterSpacing: 3,
        marks: {},
      }).node,
    );
  }
  const step = box.w / list.length;
  list.forEach((n, i) => {
    const cx = box.x + step * i + step / 2;
    out.push({ kind: "ellipse", cx, cy: axisY, rx: 9, ry: 9, fill: accent });
    out.push({ kind: "line", x1: cx, y1: axisY, x2: cx, y2: axisY + 24, stroke: withAlpha(c.pal.fg, 0.4), lineWidth: 2 });
    const size = Math.max(15, Math.min(21, step * 0.15));
    out.push(
      fixedBlock(c, n.label, {
        x: cx - step / 2 + 4,
        y: axisY + 32,
        w: step - 8,
        size,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        align: "center",
        lineHeight: 1.12,
        marks: {},
      }).node,
    );
    if (n.text) {
      out.push(
        fixedBlock(c, n.text, {
          x: cx - step / 2 + 4,
          y: axisY + 32 + size * 1.35,
          w: step - 8,
          size: size * 0.82,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          align: "center",
          lineHeight: 1.18,
          marks: {},
        }).node,
      );
    }
  });
  return out;
}

/* ------------------------------ hub/spoke ----------------------------- */

/** Central subject with radiating labelled icon nodes. */
export function hubSpoke(
  c: Ctx,
  cx: number,
  cy: number,
  radius: number,
  hub: string,
  nodes: { label: string }[],
  o?: { accent?: string; hubR?: number },
): Node[] {
  const list = nodes.slice(0, 8);
  const accent = o?.accent ?? c.pal.accent;
  const hubR = o?.hubR ?? radius * 0.32;
  const out: Node[] = [];

  list.forEach((n, i) => {
    const a = (-Math.PI / 2) + (i / Math.max(1, list.length)) * Math.PI * 2;
    const nx = cx + Math.cos(a) * radius;
    const ny = cy + Math.sin(a) * radius;
    out.push({
      kind: "line",
      x1: cx + Math.cos(a) * hubR,
      y1: cy + Math.sin(a) * hubR,
      x2: nx - Math.cos(a) * 34,
      y2: ny - Math.sin(a) * 34,
      stroke: withAlpha(accent, 0.45),
      lineWidth: 2,
      dash: [7, 7],
    });
    out.push({ kind: "ellipse", cx: nx, cy: ny, rx: 32, ry: 32, fill: withAlpha(accent, 0.14), stroke: withAlpha(accent, 0.5), lineWidth: 2 });
    const g = P.icon(iconFor(n.label), nx - 17, ny - 17, 34, accent, { width: 2.5 });
    if (g) out.push(g);
    out.push(
      fixedBlock(c, n.label, {
        x: nx - 80,
        y: ny + 38,
        w: 160,
        size: 18,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.fg,
        align: "center",
        lineHeight: 1.1,
        uppercase: true,
        letterSpacing: 0.5,
        marks: {},
      }).node,
    );
  });

  out.push({ kind: "ellipse", cx, cy, rx: hubR, ry: hubR, fill: accent });
  const hubSize = Math.max(18, hubR * 0.42);
  out.push(
    fixedBlock(c, hub, {
      x: cx - hubR,
      y: cy - hubSize * 0.7,
      w: hubR * 2,
      size: hubSize,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.dark ? "#0b0b0c" : "#ffffff",
      align: "center",
      lineHeight: 1.1,
      uppercase: true,
      marks: {},
    }).node,
  );
  return out;
}

/* --------------------------- component graph -------------------------- */

/** Boxes wired with orthogonal connectors — a system architecture sketch. */
export function componentGraph(
  c: Ctx,
  box: Box,
  nodes: { label: string; text?: string }[],
  o?: { cols?: number; accent?: string },
): Node[] {
  const list = nodes.slice(0, 6);
  if (!list.length) return [];
  const cols = o?.cols ?? (list.length <= 3 ? 1 : 2);
  const rows = Math.ceil(list.length / cols);
  const accent = o?.accent ?? c.pal.accent;
  const gx = 40;
  const gy = 26;
  const w = (box.w - gx * (cols - 1)) / cols;
  const h = (box.h - gy * (rows - 1)) / rows;
  const out: Node[] = [];
  const centres: [number, number][] = [];

  list.forEach((n, i) => {
    const x = box.x + (i % cols) * (w + gx);
    const y = box.y + Math.floor(i / cols) * (h + gy);
    centres.push([x + w / 2, y + h / 2]);
    out.push({
      kind: "rect",
      x,
      y,
      w,
      h,
      r: 12,
      fill: withAlpha(c.pal.fg, 0.05),
      stroke: withAlpha(accent, 0.5),
      lineWidth: 2,
    });
    const iconS = Math.min(38, h * 0.34);
    const g = P.icon(iconFor(n.label), x + 16, y + 14, iconS, accent, { width: 2.5 });
    if (g) out.push(g);
    const size = Math.max(17, Math.min(24, h * 0.2));
    out.push(
      fixedBlock(c, n.label, {
        x: x + 16,
        y: y + 14 + iconS + 10,
        w: w - 32,
        size,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        uppercase: true,
        letterSpacing: 0.5,
        lineHeight: 1.1,
        marks: {},
      }).node,
    );
    if (n.text) {
      out.push(
        fixedBlock(c, n.text, {
          x: x + 16,
          y: y + 14 + iconS + 10 + size * 1.3,
          w: w - 32,
          size: size * 0.76,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          lineHeight: 1.2,
          marks: {},
        }).node,
      );
    }
  });

  for (let i = 0; i < centres.length - 1; i++) {
    const [x1, y1] = centres[i];
    const [x2, y2] = centres[i + 1];
    const midY = (y1 + y2) / 2;
    out.push({
      kind: "path",
      d: `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`,
      stroke: withAlpha(accent, 0.4),
      lineWidth: 2,
      dash: [6, 6],
      cap: "round",
      join: "round",
    });
  }
  return out;
}

/* ------------------------------- bento -------------------------------- */

export interface BentoCell {
  /** Grid span, in a 4-column grid. */
  cols: number;
  rows: number;
  label?: string;
  value?: string;
  kind?: "text" | "chart" | "donut" | "spark" | "icon";
}

/** Mosaic of mixed-size cards on a 4-column grid. */
export function bentoGrid(c: Ctx, box: Box, cells: BentoCell[], o?: { rowCount?: number }): Node[] {
  const COLS = 4;
  const rowCount = o?.rowCount ?? 4;
  const gap = 14;
  const cw = (box.w - gap * (COLS - 1)) / COLS;
  const ch = (box.h - gap * (rowCount - 1)) / rowCount;
  // Simple first-fit packer over a boolean occupancy grid.
  const grid: boolean[][] = Array.from({ length: rowCount }, () => Array(COLS).fill(false));
  const out: Node[] = [];

  const fits = (r: number, cc: number, w: number, h: number) => {
    if (r + h > rowCount || cc + w > COLS) return false;
    for (let y = r; y < r + h; y++) for (let x = cc; x < cc + w; x++) if (grid[y][x]) return false;
    return true;
  };

  for (const cell of cells) {
    const w = Math.max(1, Math.min(COLS, cell.cols));
    const h = Math.max(1, Math.min(rowCount, cell.rows));
    let placed = false;
    for (let r = 0; r < rowCount && !placed; r++) {
      for (let cc = 0; cc < COLS && !placed; cc++) {
        if (!fits(r, cc, w, h)) continue;
        for (let y = r; y < r + h; y++) for (let x = cc; x < cc + w; x++) grid[y][x] = true;
        placed = true;
        const x = box.x + cc * (cw + gap);
        const y = box.y + r * (ch + gap);
        const bw = cw * w + gap * (w - 1);
        const bh = ch * h + gap * (h - 1);
        out.push({
          kind: "rect",
          x,
          y,
          w: bw,
          h: bh,
          r: 20,
          fill: c.pal.surface,
          stroke: withAlpha(c.pal.fg, 0.1),
          lineWidth: 1.5,
        });
        const inner = { x: x + 18, y: y + 18, w: bw - 36, h: bh - 36 };
        if (cell.kind === "chart") {
          out.push(
            ...D.barChart(c, { ...inner, h: inner.h * 0.7 }, [4, 7, 5, 9, 6], {
              color: c.pal.accent,
              highlight: 3,
            }),
          );
        } else if (cell.kind === "donut") {
          out.push(
            ...D.donut(c, x + bw / 2, y + bh / 2, Math.min(bw, bh) / 2 - 24, 0.68, {
              color: c.pal.accent,
            }),
          );
        } else if (cell.kind === "spark") {
          out.push(
            ...D.sparkline(c, { ...inner, h: inner.h * 0.6 }, [3, 5, 4, 8, 6, 11], {
              color: c.pal.accent2,
              fill: true,
            }),
          );
        } else if (cell.kind === "icon") {
          const s = Math.min(inner.w, inner.h) * 0.6;
          const g = P.icon(iconFor(cell.label ?? "idea"), x + bw / 2 - s / 2, y + bh / 2 - s / 2, s, c.pal.accent, {
            width: Math.max(2.5, s * 0.06),
          });
          if (g) out.push(g);
        }
        if (cell.value) {
          out.push(
            fixedBlock(c, cell.value, {
              x: inner.x,
              y: inner.y,
              w: inner.w,
              size: Math.max(26, Math.min(58, bh * 0.3)),
              font: c.fonts.sans,
              weight: 800,
              color: c.pal.accent,
              letterSpacing: -1.5,
              lineHeight: 1,
              marks: {},
            }).node,
          );
        }
        if (cell.label) {
          const ls = Math.max(15, Math.min(24, bw * 0.07));
          out.push(
            fixedBlock(c, cell.label, {
              x: inner.x,
              y: y + bh - 18 - ls * 1.3,
              w: inner.w,
              size: ls,
              font: c.fonts.sans,
              weight: cell.kind === "text" ? 700 : 600,
              color: cell.kind === "text" ? c.pal.fg : c.pal.muted,
              lineHeight: 1.15,
              marks: {},
            }).node,
          );
        }
      }
    }
  }
  return out;
}
