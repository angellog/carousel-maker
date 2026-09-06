import { mix, withAlpha } from "../theme";
import type { Ctx } from "./ctx";
import { fixedBlock, textWidth } from "./ctx";
import { iconPath } from "./icons";
import type { Node, Paint, TextAlign } from "./scene";
import { sketchLine } from "./decor";

/* ------------------------------ sparkles ------------------------------ */

/** Four-point star. The single most common decorative mark in the reference set. */
export function sparkle(cx: number, cy: number, r: number, color: string, waist = 0.26): Node {
  const w = r * waist;
  return {
    kind: "path",
    d: `M ${cx} ${cy - r} C ${cx + w} ${cy - w} ${cx + w} ${cy - w} ${cx + r} ${cy} C ${cx + w} ${cy + w} ${cx + w} ${cy + w} ${cx} ${cy + r} C ${cx - w} ${cy + w} ${cx - w} ${cy + w} ${cx - r} ${cy} C ${cx - w} ${cy - w} ${cx - w} ${cy - w} ${cx} ${cy - r} Z`,
    fill: color,
  };
}

/** Scatter sparkles around the frame, avoiding a protected centre band. */
export function sparkleField(
  c: Ctx,
  color: string,
  count = 7,
  opts?: { min?: number; max?: number; avoid?: { x: number; y: number; w: number; h: number } },
): Node[] {
  const out: Node[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 12) {
    const x = 40 + c.rand() * (c.w - 80);
    const y = 40 + c.rand() * (c.h - 80);
    const a = opts?.avoid;
    if (a && x > a.x && x < a.x + a.w && y > a.y && y < a.y + a.h) continue;
    const r = (opts?.min ?? 12) + c.rand() * ((opts?.max ?? 30) - (opts?.min ?? 12));
    out.push(sparkle(x, y, r, color));
  }
  return out;
}

/* ------------------------------- paper -------------------------------- */

export interface RuledPageOptions {
  paper?: string;
  rule?: string;
  ruleStep?: number;
  margin?: boolean;
  marginColor?: string;
  spiral?: boolean;
  inset?: number;
  radius?: number;
}

/** Ruled notebook page with optional red margin and spiral binding. */
export function ruledPage(c: Ctx, o: RuledPageOptions = {}): Node[] {
  const inset = o.inset ?? 0;
  const paper = o.paper ?? "#fdfcf7";
  const rule = o.rule ?? "#c8d8ec";
  const step = o.ruleStep ?? 52;
  const x = inset;
  const y = inset;
  const w = c.w - inset * 2;
  const h = c.h - inset * 2;
  const out: Node[] = [
    {
      kind: "rect",
      x,
      y,
      w,
      h,
      r: o.radius ?? 0,
      fill: paper,
      shadow: inset > 0 ? { color: "rgba(0,0,0,0.22)", blur: 40, x: 0, y: 14 } : undefined,
    },
  ];
  const left = o.spiral ? x + 108 : x;
  for (let ly = y + step; ly < y + h - step * 0.4; ly += step) {
    out.push({ kind: "line", x1: left, y1: ly, x2: x + w, y2: ly, stroke: rule, lineWidth: 1.6 });
  }
  if (o.margin !== false) {
    const mx = left + 46;
    out.push({
      kind: "line",
      x1: mx,
      y1: y,
      x2: mx,
      y2: y + h,
      stroke: o.marginColor ?? "#f0a3a3",
      lineWidth: 2,
    });
  }
  if (o.spiral) {
    const holeX = x + 54;
    for (let hy = y + 70; hy < y + h - 50; hy += 96) {
      out.push(
        { kind: "ellipse", cx: holeX, cy: hy, rx: 17, ry: 17, fill: withAlpha("#000000", 0.14) },
        {
          kind: "path",
          d: `M ${holeX - 34} ${hy - 26} C ${holeX + 6} ${hy - 40} ${holeX + 30} ${hy - 12} ${holeX + 4} ${hy + 6}`,
          stroke: "#9aa3ad",
          lineWidth: 9,
          cap: "round",
        },
      );
    }
  }
  return out;
}

/** Dotted / grid stationery without the notebook furniture. */
export function gridPaper(c: Ctx, color: string, step = 48, lineWidth = 1): Node[] {
  const out: Node[] = [];
  for (let x = 0; x < c.w; x += step)
    out.push({ kind: "line", x1: x, y1: 0, x2: x, y2: c.h, stroke: color, lineWidth });
  for (let y = 0; y < c.h; y += step)
    out.push({ kind: "line", x1: 0, y1: y, x2: c.w, y2: y, stroke: color, lineWidth });
  return out;
}

/* --------------------------- print furniture -------------------------- */

/** Corner crop marks — the "designed by a designer" tell. */
export function cropMarks(c: Ctx, inset: number, len: number, color: string, width = 2): Node[] {
  const p: [number, number][] = [
    [inset, inset],
    [c.w - inset, inset],
    [inset, c.h - inset],
    [c.w - inset, c.h - inset],
  ];
  return p.flatMap(([x, y], i) => {
    const sx = i % 2 === 0 ? 1 : -1;
    const sy = i < 2 ? 1 : -1;
    return [
      { kind: "line", x1: x, y1: y, x2: x + len * sx, y2: y, stroke: color, lineWidth: width },
      { kind: "line", x1: x, y1: y, x2: x, y2: y + len * sy, stroke: color, lineWidth: width },
    ] as Node[];
  });
}

/** Masking-tape label with a rotated strip and a caption. */
export function tapeLabel(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  o?: { angle?: number; fill?: string; color?: string; size?: number; font?: string },
): Node[] {
  const size = o?.size ?? 22;
  const font = o?.font ?? c.fonts.sans;
  const label = text.toUpperCase();
  const tw = textWidth(c, label, font, size, 700, 1.5);
  const w = tw + 44;
  const h = size + 26;
  const angle = o?.angle ?? -0.04;
  return [
    {
      kind: "rect",
      x,
      y,
      w,
      h,
      fill: o?.fill ?? "#f2e2b8",
      rotate: angle,
      origin: [x + w / 2, y + h / 2],
      shadow: { color: "rgba(0,0,0,0.12)", blur: 10, x: 0, y: 3 },
    },
    {
      ...fixedBlock(c, label, {
        x: x + 22,
        y: y + 13,
        w: tw + 6,
        size,
        font,
        weight: 700,
        color: o?.color ?? "#3b2f1c",
        letterSpacing: 1.5,
        marks: {},
      }).node,
      rotate: angle,
      origin: [x + w / 2, y + h / 2],
    },
  ];
}

/* ------------------------------ 3D type ------------------------------- */

export interface ExtrudeOptions {
  x: number;
  y: number;
  w: number;
  size: number;
  font: string;
  weight?: number;
  align?: TextAlign;
  lineHeight?: number;
  face: string;
  /** Extrusion colour; drawn as stacked offset copies. */
  shadow: string;
  depth?: number;
  angle?: number;
  outline?: string;
  outlineWidth?: number;
  letterSpacing?: number;
}

/**
 * Chunky offset-extruded display type, as seen on the retro sticker templates.
 * Built from stacked text copies — no filters, no images.
 */
export function extrudeText(c: Ctx, text: string, o: ExtrudeOptions): Node[] {
  const depth = o.depth ?? Math.max(6, o.size * 0.11);
  const angle = o.angle ?? Math.PI / 4;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const base = {
    w: o.w,
    size: o.size,
    font: o.font,
    weight: o.weight ?? 800,
    align: o.align ?? ("center" as TextAlign),
    lineHeight: o.lineHeight ?? 1.02,
    letterSpacing: o.letterSpacing,
    marks: {},
  };
  const out: Node[] = [];
  const steps = Math.max(2, Math.round(depth));
  for (let i = steps; i >= 1; i--) {
    out.push(fixedBlock(c, text, { ...base, x: o.x + dx * i, y: o.y + dy * i, color: o.shadow }).node);
  }
  if (o.outline) {
    const ow = o.outlineWidth ?? Math.max(3, o.size * 0.03);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      out.push(
        fixedBlock(c, text, {
          ...base,
          x: o.x + Math.cos(a) * ow,
          y: o.y + Math.sin(a) * ow,
          color: o.outline,
        }).node,
      );
    }
  }
  out.push(fixedBlock(c, text, { ...base, x: o.x, y: o.y, color: o.face }).node);
  return out;
}

/* ---------------------------- speech bubble --------------------------- */

export function speechBubble(
  c: Ctx,
  text: string,
  o: {
    x: number;
    y: number;
    w: number;
    size?: number;
    font?: string;
    fill?: string;
    color?: string;
    stroke?: string;
    tail?: "bl" | "br" | "tl" | "tr" | "none";
    radius?: number;
    rotate?: number;
  },
): Node[] {
  const size = o.size ?? 24;
  const font = o.font ?? c.fonts.hand;
  const padX = 26;
  const padY = 22;
  const body = fixedBlock(c, text, {
    x: o.x + padX,
    y: o.y + padY,
    w: o.w - padX * 2,
    size,
    font,
    weight: 600,
    color: o.color ?? c.pal.fg,
    lineHeight: 1.3,
    align: "center",
    marks: {},
  });
  const h = body.height + padY * 2;
  const r = o.radius ?? 26;
  const tail = o.tail ?? "bl";
  const nodes: Node[] = [
    {
      kind: "rect",
      x: o.x,
      y: o.y,
      w: o.w,
      h,
      r,
      fill: o.fill ?? c.pal.surface,
      stroke: o.stroke,
      lineWidth: o.stroke ? 3 : undefined,
      rotate: o.rotate,
      origin: [o.x + o.w / 2, o.y + h / 2],
    },
  ];
  if (tail !== "none") {
    const bottom = tail[0] === "b";
    const left = tail[1] === "l";
    const tx = left ? o.x + o.w * 0.24 : o.x + o.w * 0.76;
    const ty = bottom ? o.y + h : o.y;
    const dir = bottom ? 1 : -1;
    nodes.push({
      kind: "path",
      d: `M ${tx - 20} ${ty} L ${tx + (left ? -34 : 34)} ${ty + 30 * dir} L ${tx + 20} ${ty} Z`,
      fill: o.fill ?? c.pal.surface,
      stroke: o.stroke,
      lineWidth: o.stroke ? 3 : undefined,
      rotate: o.rotate,
      origin: [o.x + o.w / 2, o.y + h / 2],
    });
  }
  nodes.push({ ...body.node, rotate: o.rotate, origin: [o.x + o.w / 2, o.y + h / 2] });
  return nodes;
}

/* ------------------------------- icons -------------------------------- */

export function icon(
  name: string,
  x: number,
  y: number,
  size: number,
  color: string,
  o?: { width?: number; fill?: boolean; opacity?: number },
): Node | null {
  const d = iconPath(name, x, y, size);
  if (!d) return null;
  return {
    kind: "path",
    d,
    stroke: o?.fill ? undefined : color,
    fill: o?.fill ? color : undefined,
    lineWidth: o?.width ?? Math.max(2, size * 0.07),
    cap: "round",
    join: "round",
    opacity: o?.opacity,
  };
}

/** Icon inside a soft rounded tile. */
export function iconTile(
  c: Ctx,
  name: string,
  x: number,
  y: number,
  size: number,
  o?: { fill?: Paint; color?: string; radius?: number; pad?: number; stroke?: string },
): Node[] {
  const pad = o?.pad ?? size * 0.24;
  const out: Node[] = [
    {
      kind: "rect",
      x,
      y,
      w: size,
      h: size,
      r: o?.radius ?? size * 0.28,
      fill: o?.fill ?? withAlpha(c.pal.accent, 0.14),
      stroke: o?.stroke,
      lineWidth: o?.stroke ? 2 : undefined,
    },
  ];
  const g = icon(name, x + pad, y + pad, size - pad * 2, o?.color ?? c.pal.accent);
  if (g) out.push(g);
  return out;
}

/* ------------------------------ UI mock ------------------------------- */

/**
 * A generic app-window card. Several reference posts float a product
 * screenshot; this draws a convincing stand-in from primitives.
 */
export function windowCard(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o?: { fill?: string; bar?: string; rows?: number; accent?: string; rotate?: number; radius?: number },
): Node[] {
  const fill = o?.fill ?? (c.pal.dark ? "#16181d" : "#ffffff");
  const bar = o?.bar ?? (c.pal.dark ? "#22252c" : "#f1f2f4");
  const accent = o?.accent ?? c.pal.accent;
  const radius = o?.radius ?? 18;
  const barH = Math.min(44, h * 0.14);
  const rot = o?.rotate;
  const origin: [number, number] = [x + w / 2, y + h / 2];
  const out: Node[] = [
    {
      kind: "rect",
      x,
      y,
      w,
      h,
      r: radius,
      fill,
      rotate: rot,
      origin,
      shadow: { color: "rgba(0,0,0,0.28)", blur: 40, x: 0, y: 16 },
    },
    { kind: "rect", x, y, w, h: barH, r: [radius, radius, 0, 0], fill: bar, rotate: rot, origin },
  ];
  ["#ff5f57", "#febc2e", "#28c840"].forEach((col, i) => {
    out.push({
      kind: "ellipse",
      cx: x + 22 + i * 20,
      cy: y + barH / 2,
      rx: 6,
      ry: 6,
      fill: col,
      rotate: rot,
      origin,
    });
  });
  const rows = o?.rows ?? 5;
  const top = y + barH + 26;
  const avail = h - barH - 46;
  const rowH = avail / rows;
  for (let i = 0; i < rows; i++) {
    const rw = (w - 56) * (0.45 + ((i * 37) % 55) / 100);
    out.push({
      kind: "rect",
      x: x + 28,
      y: top + i * rowH,
      w: rw,
      h: Math.min(16, rowH * 0.42),
      r: 8,
      fill: i === 1 ? withAlpha(accent, 0.85) : withAlpha(c.pal.dark ? "#ffffff" : "#0f172a", 0.13),
      rotate: rot,
      origin,
    });
  }
  return out;
}

/** Rough marker rectangle drawn around a phrase. */
export function sketchBox(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  width = 5,
): Node {
  const pts: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
    [x, y - 2],
  ];
  return { kind: "path", d: sketchLine(c, pts, 6), stroke: color, lineWidth: width, cap: "round", join: "round" };
}

export { mix, withAlpha };
