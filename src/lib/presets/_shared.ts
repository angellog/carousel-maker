import { mix, withAlpha } from "../theme";
import type { FontKey } from "../theme";
import type { SlideField } from "../types";
import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, stack, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import type { Node, Paint, Scene, TextAlign } from "../render/scene";
import type { MarkTheme } from "../render/text";

/** A measured piece of a slide; positioned later by the stacker. */
export interface Part {
  h: number;
  draw(y: number): Node[];
}

export type BulletStyle = "dot" | "dash" | "number" | "check" | "arrow" | "none" | "square";

export interface ShellStyle {
  align: TextAlign;
  justify: "start" | "center" | "end";
  gap: number;

  kickerFont: FontKey;
  kickerWeight: number;
  kickerSize: number;
  kickerLS: number;
  kickerUpper: boolean;
  kickerColor: string;
  /** Draw the kicker as a filled chip instead of bare type. */
  kickerChip?: { fill: Paint; color: string; radius?: number };

  titleFont: FontKey;
  titleWeight: number;
  titleMax: number;
  titleMin: number;
  titleLH: number;
  titleLS: number;
  titleUpper: boolean;
  titleColor: string;

  bodyFont: FontKey;
  bodyWeight: number;
  bodySize: number;
  bodyLH: number;
  bodyColor: string;

  bullet: BulletStyle;
  bulletColor: string;
  bulletGap: number;
  marks?: MarkTheme;
}

export function defaultShell(c: Ctx, over: Partial<ShellStyle> = {}): ShellStyle {
  return {
    align: "left",
    justify: "center",
    gap: 34,
    kickerFont: "sans",
    kickerWeight: 700,
    kickerSize: 24,
    kickerLS: 3,
    kickerUpper: true,
    kickerColor: c.pal.accent,
    titleFont: "sans",
    titleWeight: 800,
    titleMax: 96,
    titleMin: 40,
    titleLH: 1.05,
    titleLS: -1.5,
    titleUpper: false,
    titleColor: c.pal.fg,
    bodyFont: "sans",
    bodyWeight: 400,
    bodySize: 34,
    bodyLH: 1.42,
    bodyColor: c.pal.muted,
    bullet: "dot",
    bulletColor: c.pal.accent,
    bulletGap: 26,
    ...over,
  };
}

/** Content area with room reserved for the footer chrome. */
export function bodyBox(c: Ctx, footerSpace = 92): Box {
  const b = contentBox(c);
  return { x: b.x, y: b.y, w: b.w, h: b.h - footerSpace };
}

/* ----------------------------- parts ---------------------------------- */

export function kickerPart(c: Ctx, s: ShellStyle, box: Box, text?: string): Part | null {
  const label = text ?? c.slide.kicker;
  if (!label) return null;
  if (s.kickerChip) {
    const probe = D.chip(c, label, {
      x: 0,
      y: 0,
      size: s.kickerSize,
      font: c.fonts[s.kickerFont],
      weight: s.kickerWeight,
      fill: s.kickerChip.fill,
      color: s.kickerChip.color,
      radius: s.kickerChip.radius,
      letterSpacing: s.kickerLS,
    });
    const x =
      s.align === "center"
        ? box.x + (box.w - probe.w) / 2
        : s.align === "right"
          ? box.x + box.w - probe.w
          : box.x;
    return {
      h: probe.h,
      draw: (y) =>
        D.chip(c, label, {
          x,
          y,
          size: s.kickerSize,
          font: c.fonts[s.kickerFont],
          weight: s.kickerWeight,
          fill: s.kickerChip!.fill,
          color: s.kickerChip!.color,
          radius: s.kickerChip!.radius,
          letterSpacing: s.kickerLS,
        }).nodes,
    };
  }
  const b = fixedBlock(c, label, {
    x: box.x,
    y: 0,
    w: box.w,
    size: s.kickerSize,
    font: c.fonts[s.kickerFont],
    weight: s.kickerWeight,
    color: s.kickerColor,
    align: s.align,
    letterSpacing: s.kickerLS,
    uppercase: s.kickerUpper,
    lineHeight: 1.2,
    marks: {},
  });
  return { h: b.height, draw: (y) => [{ ...b.node, y }] };
}

export function titlePart(
  c: Ctx,
  s: ShellStyle,
  box: Box,
  text?: string,
  maxH = box.h * 0.62,
): Part | null {
  const t = text ?? c.slide.title;
  if (!t) return null;
  const b = block(c, t, {
    x: box.x,
    y: 0,
    w: box.w,
    maxH,
    font: c.fonts[s.titleFont],
    weight: s.titleWeight,
    max: s.titleMax,
    min: s.titleMin,
    lineHeight: s.titleLH,
    align: s.align,
    color: s.titleColor,
    letterSpacing: s.titleLS,
    uppercase: s.titleUpper,
    marks: s.marks,
  });
  return { h: b.height, draw: (y) => [{ ...b.node, y }] };
}

export function bodyPart(c: Ctx, s: ShellStyle, box: Box, text?: string): Part | null {
  const t = text ?? c.slide.body;
  if (!t) return null;
  const b = fixedBlock(c, t, {
    x: box.x,
    y: 0,
    w: box.w,
    size: s.bodySize,
    font: c.fonts[s.bodyFont],
    weight: s.bodyWeight,
    color: s.bodyColor,
    align: s.align,
    lineHeight: s.bodyLH,
    marks: s.marks,
  });
  return { h: b.height, draw: (y) => [{ ...b.node, y }] };
}

export function bulletsPart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  const items = c.slide.bullets;
  if (!items || items.length === 0 || s.bullet === "none") return null;
  const size = Math.min(s.bodySize, Math.max(24, 40 - items.length * 1.6));
  const markW = size * 1.9;
  const textX = box.x + markW;
  const textW = box.w - markW;
  const rows = items.map((it, i) =>
    fixedBlock(c, it, {
      x: textX,
      y: 0,
      w: textW,
      size,
      font: c.fonts[s.bodyFont],
      weight: s.bodyWeight === 400 ? 500 : s.bodyWeight,
      color: c.pal.fg,
      lineHeight: 1.3,
      marks: s.marks,
    }),
  );
  const heights = rows.map((r) => r.height);
  const total = heights.reduce((a, b) => a + b, 0) + s.bulletGap * (rows.length - 1);
  return {
    h: total,
    draw(y) {
      const out: Node[] = [];
      let cy = y;
      rows.forEach((r, i) => {
        out.push({ ...r.node, y: cy });
        const midY = cy + size * 0.66;
        out.push(...bulletMark(c, s, box.x, midY, size, i));
        cy += heights[i] + s.bulletGap;
      });
      return out;
    },
  };
}

function bulletMark(
  c: Ctx,
  s: ShellStyle,
  x: number,
  midY: number,
  size: number,
  i: number,
): Node[] {
  const col = s.bulletColor;
  switch (s.bullet) {
    case "dot":
      return [{ kind: "ellipse", cx: x + size * 0.34, cy: midY, rx: size * 0.17, ry: size * 0.17, fill: col }];
    case "square":
      return [
        { kind: "rect", x: x + size * 0.16, y: midY - size * 0.17, w: size * 0.34, h: size * 0.34, fill: col },
      ];
    case "dash":
      return [
        { kind: "line", x1: x, y1: midY, x2: x + size * 0.72, y2: midY, stroke: col, lineWidth: Math.max(3, size * 0.1), cap: "round" },
      ];
    case "arrow":
      return [D.arrow(x, midY, size * 0.9, col, Math.max(2.5, size * 0.08))];
    case "check":
      return D.checkbox(c, x, midY - size * 0.4, size * 0.8, true, { check: col });
    case "number": {
      const label = String(i + 1).padStart(2, "0");
      return [
        fixedBlock(c, label, {
          x,
          y: midY - size * 0.58,
          w: size * 1.7,
          size: size * 0.95,
          font: c.fonts.mono,
          weight: 700,
          color: col,
          marks: {},
        }).node,
      ];
    }
    default:
      return [];
  }
}

export function statPart(
  c: Ctx,
  s: ShellStyle,
  box: Box,
  o?: { valueFont?: FontKey; valueColor?: string; big?: number },
): Part | null {
  const st = c.slide.stat;
  if (!st) return null;
  const big = block(c, st.value, {
    x: box.x,
    y: 0,
    w: box.w,
    maxH: box.h * 0.4,
    font: c.fonts[o?.valueFont ?? "sans"],
    weight: 800,
    max: o?.big ?? 200,
    min: 72,
    lineHeight: 0.98,
    align: s.align,
    color: o?.valueColor ?? c.pal.accent,
    letterSpacing: -4,
    maxLines: 1,
    marks: {},
  });
  const lab = fixedBlock(c, st.label, {
    x: box.x,
    y: 0,
    w: box.w,
    size: 30,
    font: c.fonts[s.bodyFont],
    weight: 500,
    color: c.pal.muted,
    align: s.align,
    lineHeight: 1.3,
    marks: s.marks,
  });
  const gap = 18;
  const deltaH = st.delta ? 54 : 0;
  return {
    h: big.height + gap + lab.height + (deltaH ? deltaH + 14 : 0),
    draw(y) {
      const out: Node[] = [{ ...big.node, y }];
      let cy = y + big.height + gap;
      if (st.delta) {
        const up = !st.delta.trim().startsWith("-");
        const ch = D.chip(c, st.delta, {
          x: 0,
          y: 0,
          size: 24,
          weight: 700,
          fill: withAlpha(up ? c.pal.accent2 : "#ff453a", 0.18),
          color: up ? c.pal.accent2 : "#ff453a",
          letterSpacing: 0.5,
          uppercase: false,
        });
        const cx =
          s.align === "center" ? box.x + (box.w - ch.w) / 2 : s.align === "right" ? box.x + box.w - ch.w : box.x;
        out.push(
          ...D.chip(c, st.delta, {
            x: cx,
            y: cy,
            size: 24,
            weight: 700,
            fill: withAlpha(up ? c.pal.accent2 : "#ff453a", 0.18),
            color: up ? c.pal.accent2 : "#ff453a",
            letterSpacing: 0.5,
            uppercase: false,
          }).nodes,
        );
        cy += ch.h + 14;
      }
      out.push({ ...lab.node, y: cy });
      return out;
    },
  };
}

export function quotePart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  const q = c.slide.quote;
  if (!q) return null;
  const body = block(c, `“${q.text}”`, {
    x: box.x,
    y: 0,
    w: box.w,
    maxH: box.h * 0.6,
    font: c.fonts.serif,
    weight: 400,
    max: 74,
    min: 34,
    lineHeight: 1.22,
    align: s.align,
    color: c.pal.fg,
    marks: s.marks,
  });
  const attr = fixedBlock(c, `— ${q.author}${q.role ? `, ${q.role}` : ""}`, {
    x: box.x,
    y: 0,
    w: box.w,
    size: 26,
    font: c.fonts.sans,
    weight: 600,
    color: c.pal.muted,
    align: s.align,
    letterSpacing: 0.5,
    marks: {},
  });
  return {
    h: body.height + 32 + attr.height,
    draw: (y) => [{ ...body.node, y }, { ...attr.node, y: y + body.height + 32 }],
  };
}

export function stepsPart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  const steps = c.slide.steps;
  if (!steps || steps.length === 0) return null;
  const r = Math.min(38, box.w / (steps.length * 3.4));
  const labelSize = Math.max(24, 34 - steps.length * 1.5);
  const textX = box.x + r * 2 + 28;
  const textW = box.w - (r * 2 + 28);
  const rows = steps.map((st) => {
    const head = fixedBlock(c, st.label, {
      x: textX,
      y: 0,
      w: textW,
      size: labelSize + 4,
      font: c.fonts.sans,
      weight: 700,
      color: c.pal.fg,
      lineHeight: 1.2,
      marks: s.marks,
    });
    const sub = st.text
      ? fixedBlock(c, st.text, {
          x: textX,
          y: 0,
          w: textW,
          size: labelSize - 2,
          font: c.fonts.sans,
          weight: 400,
          color: c.pal.muted,
          lineHeight: 1.32,
          marks: s.marks,
        })
      : null;
    return { head, sub, h: head.height + (sub ? sub.height + 8 : 0) };
  });
  const gap = 34;
  const total = rows.reduce((a, b) => a + b.h, 0) + gap * (rows.length - 1);
  return {
    h: Math.max(total, r * 2),
    draw(y) {
      const out: Node[] = [];
      let cy = y;
      rows.forEach((row, i) => {
        const badgeY = cy + r * 0.72;
        out.push(...D.numberBadge(c, i + 1, box.x + r, badgeY, r, { fill: c.pal.accent, color: c.pal.bg }));
        if (i < rows.length - 1) {
          out.push({
            kind: "line",
            x1: box.x + r,
            y1: badgeY + r + 8,
            x2: box.x + r,
            y2: cy + row.h + gap + r * 0.72 - r - 8,
            stroke: withAlpha(c.pal.accent, 0.35),
            lineWidth: 3,
            dash: [8, 8],
          });
        }
        out.push({ ...row.head.node, y: cy });
        if (row.sub) out.push({ ...row.sub.node, y: cy + row.head.height + 8 });
        cy += row.h + gap;
      });
      return out;
    },
  };
}

export function comparePart(
  c: Ctx,
  s: ShellStyle,
  box: Box,
  o?: { leftColor?: string; rightColor?: string; divider?: boolean },
): Part | null {
  const cmp = c.slide.compare;
  if (!cmp) return null;
  const colW = (box.w - 48) / 2;
  const leftColor = o?.leftColor ?? "#ff453a";
  const rightColor = o?.rightColor ?? c.pal.accent2;
  const build = (label: string, items: string[], x: number, color: string) => {
    const head = fixedBlock(c, label, {
      x,
      y: 0,
      w: colW,
      size: 26,
      font: c.fonts.sans,
      weight: 800,
      color,
      letterSpacing: 2,
      uppercase: true,
      marks: {},
    });
    const rows = items.map((it) =>
      fixedBlock(c, it, {
        x: x + 34,
        y: 0,
        w: colW - 34,
        size: 27,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.fg,
        lineHeight: 1.3,
        marks: s.marks,
      }),
    );
    return { head, rows, x, color };
  };
  const L = build(cmp.leftLabel, cmp.leftItems, box.x, leftColor);
  const R = build(cmp.rightLabel, cmp.rightItems, box.x + colW + 48, rightColor);
  const colH = (col: typeof L) =>
    col.head.height + 26 + col.rows.reduce((a, b) => a + b.height + 22, 0);
  const h = Math.max(colH(L), colH(R));
  return {
    h,
    draw(y) {
      const out: Node[] = [];
      for (const col of [L, R]) {
        out.push({ ...col.head.node, y });
        let cy = y + col.head.height + 26;
        col.rows.forEach((row) => {
          const isLeft = col === L;
          const midY = cy + 27 * 0.62;
          out.push(
            isLeft
              ? {
                  kind: "path",
                  d: `M ${col.x + 4} ${midY - 8} L ${col.x + 20} ${midY + 8} M ${col.x + 20} ${midY - 8} L ${col.x + 4} ${midY + 8}`,
                  stroke: col.color,
                  lineWidth: 3.5,
                  cap: "round",
                }
              : {
                  kind: "path",
                  d: `M ${col.x + 3} ${midY} L ${col.x + 11} ${midY + 9} L ${col.x + 23} ${midY - 10}`,
                  stroke: col.color,
                  lineWidth: 3.5,
                  cap: "round",
                  join: "round",
                },
          );
          out.push({ ...row.node, y: cy });
          cy += row.height + 22;
        });
      }
      if (o?.divider !== false) {
        out.push({
          kind: "line",
          x1: box.x + colW + 24,
          y1: y - 8,
          x2: box.x + colW + 24,
          y2: y + h + 8,
          stroke: withAlpha(c.pal.fg, 0.18),
          lineWidth: 2,
        });
      }
      return out;
    },
  };
}

export function itemsPart(c: Ctx, s: ShellStyle, box: Box, o?: { mono?: boolean; dotted?: boolean }): Part | null {
  const items = c.slide.items;
  if (!items || items.length === 0) return null;
  const size = Math.max(22, 32 - items.length * 1.1);
  const font = o?.mono ? c.fonts.mono : c.fonts.sans;
  const rowH = size * 1.9;
  return {
    h: rowH * items.length,
    draw(y) {
      const out: Node[] = [];
      items.forEach((it, i) => {
        const ry = y + i * rowH;
        const vw = textWidth(c, it.value, font, size, 700);
        out.push(
          fixedBlock(c, it.label, {
            x: box.x,
            y: ry,
            w: box.w - vw - 24,
            size,
            font,
            weight: 500,
            color: c.pal.fg,
            marks: s.marks,
          }).node,
          fixedBlock(c, it.value, {
            x: box.x + box.w - vw,
            y: ry,
            w: vw + 6,
            size,
            font,
            weight: 700,
            color: c.pal.accent,
            marks: {},
          }).node,
        );
        if (o?.dotted !== false) {
          out.push({
            kind: "line",
            x1: box.x,
            y1: ry + size * 1.45,
            x2: box.x + box.w,
            y2: ry + size * 1.45,
            stroke: withAlpha(c.pal.fg, 0.16),
            lineWidth: 1.5,
            dash: [3, 6],
          });
        }
      });
      return out;
    },
  };
}

export function chatPart(c: Ctx, s: ShellStyle, box: Box, o?: { theirs?: string; mine?: string; theirsText?: string; mineText?: string }): Part | null {
  const turns = c.slide.chat;
  if (!turns || turns.length === 0) return null;
  const size = Math.max(24, 34 - turns.length * 1.2);
  const maxBubble = box.w * 0.78;
  const padX = 26;
  const padY = 20;
  const gap = 16;
  const built = turns.map((t) => {
    const b = fixedBlock(c, t.text, {
      x: 0,
      y: 0,
      w: maxBubble - padX * 2,
      size,
      font: c.fonts.sans,
      weight: 500,
      color: t.from === "me" ? (o?.mineText ?? "#ffffff") : (o?.theirsText ?? c.pal.fg),
      lineHeight: 1.32,
      marks: s.marks,
    });
    const w = Math.min(maxBubble, Math.max(...b.node.lines.map((l) => l.width)) + padX * 2);
    return { b, w, h: b.height + padY * 2, from: t.from };
  });
  const total = built.reduce((a, x) => a + x.h, 0) + gap * (built.length - 1);
  return {
    h: total,
    draw(y) {
      const out: Node[] = [];
      let cy = y;
      for (const t of built) {
        const isMe = t.from === "me";
        const x = isMe ? box.x + box.w - t.w : box.x;
        out.push({
          kind: "rect",
          x,
          y: cy,
          w: t.w,
          h: t.h,
          r: [24, 24, isMe ? 8 : 24, isMe ? 24 : 8],
          fill: isMe ? (o?.mine ?? "#0b84ff") : (o?.theirs ?? (c.pal.dark ? "#2c2c2e" : "#e9e9eb")),
        });
        out.push({ ...t.b.node, x: x + padX, y: cy + padY });
        cy += t.h + gap;
      }
      return out;
    },
  };
}

export function codePart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  const code = c.slide.code;
  if (!code || code.lines.length === 0) return null;
  const size = Math.max(20, Math.min(30, (box.w * 0.9) / Math.max(...code.lines.map((l) => l.length || 1)) / 0.62));
  const lh = 1.55;
  const padX = 30;
  const padY = 28;
  const h = code.lines.length * size * lh + padY * 2 + 46;
  return {
    h,
    draw(y) {
      const out: Node[] = [
        D.card(c, box.x, y, box.w, h, { fill: c.pal.dark ? "#0d1117" : "#0f172a", radius: 20 }),
      ];
      // window chrome dots
      ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
        out.push({ kind: "ellipse", cx: box.x + 30 + i * 24, cy: y + 26, rx: 7, ry: 7, fill: col });
      });
      out.push(
        fixedBlock(c, code.lang, {
          x: box.x + box.w - 140,
          y: y + 14,
          w: 120,
          size: 18,
          font: c.fonts.mono,
          weight: 500,
          color: "#6e7681",
          align: "right",
          marks: {},
        }).node,
      );
      code.lines.forEach((ln, i) => {
        out.push(
          fixedBlock(c, ln, {
            x: box.x + padX,
            y: y + 46 + padY + i * size * lh,
            w: box.w - padX * 2,
            size,
            font: c.fonts.mono,
            weight: 500,
            color: "#c9d1d9",
            lineHeight: 1,
            marks: {
              accent: { color: "#79c0ff", weight: 700 },
              highlight: { color: "#7ee787" },
              underline: { color: "#ffa657" },
              strike: { color: "#6e7681" },
            },
          }).node,
        );
      });
      return out;
    },
  };
}

export function notePart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  if (!c.slide.note) return null;
  const b = fixedBlock(c, c.slide.note, {
    x: box.x,
    y: 0,
    w: box.w,
    size: 21,
    font: c.fonts.sans,
    weight: 500,
    color: withAlpha(c.pal.muted, 0.9),
    align: s.align,
    lineHeight: 1.35,
    marks: s.marks,
  });
  return { h: b.height, draw: (y) => [{ ...b.node, y }] };
}

/**
 * The one feature block a slide carries beyond title/body, chosen by
 * precedence. Presets that want a specific field simply supply content for it.
 */
export function featurePart(c: Ctx, s: ShellStyle, box: Box): Part | null {
  return (
    statPart(c, s, box) ??
    quotePart(c, s, box) ??
    comparePart(c, s, box) ??
    chatPart(c, s, box) ??
    codePart(c, s, box) ??
    stepsPart(c, s, box) ??
    itemsPart(c, s, box) ??
    bulletsPart(c, s, box)
  );
}

/** Stack a list of parts inside a box according to the shell's justify rule. */
export function layoutParts(parts: (Part | null)[], box: Box, gap: number, justify: ShellStyle["justify"]): Node[] {
  const live = parts.filter((p): p is Part => !!p);
  if (live.length === 0) return [];
  const ys = stack(box.y, box.h, live.map((p) => p.h), gap, justify);
  const out: Node[] = [];
  live.forEach((p, i) => out.push(...p.draw(ys[i])));
  return out;
}

/**
 * Draw kicker → title → body at the top of a box and report where the
 * remaining space starts. Used by every diagram preset, which needs a compact
 * header and then all the room it can get.
 */
export function headStack(
  c: Ctx,
  s: ShellStyle,
  box: Box,
  o?: { titleMaxH?: number; gap?: number; skipBody?: boolean },
): { nodes: Node[]; bottom: number } {
  const gap = o?.gap ?? 16;
  const nodes: Node[] = [];
  let y = box.y;
  const parts = [
    kickerPart(c, s, box),
    titlePart(c, s, box, undefined, o?.titleMaxH ?? box.h * 0.3),
    o?.skipBody ? null : bodyPart(c, s, box),
  ];
  for (const part of parts) {
    if (!part) continue;
    nodes.push(...part.draw(y));
    y += part.h + gap;
  }
  return { nodes, bottom: y };
}

/** The default composition used by most presets. */
export function composeStack(c: Ctx, s: ShellStyle, box: Box): Node[] {
  return layoutParts(
    [
      kickerPart(c, s, box),
      titlePart(c, s, box),
      bodyPart(c, s, box),
      featurePart(c, s, box),
      notePart(c, s, box),
    ],
    box,
    s.gap,
    s.justify,
  );
}

export function scene(c: Ctx, bg: Paint, nodes: Node[]): Scene {
  return { w: c.w, h: c.h, bg, nodes };
}

export const ALL_FIELDS: SlideField[] = [
  "kicker",
  "body",
  "bullets",
  "stat",
  "quote",
  "steps",
  "compare",
  "chat",
  "code",
  "items",
  "table",
  "panels",
  "ranked",
  "note",
];

export { withAlpha, mix, D };
