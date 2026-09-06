import { mix, withAlpha } from "../theme";
import type { Ctx } from "./ctx";
import { fixedBlock, textWidth } from "./ctx";
import type { Node, Paint } from "./scene";

/* ------------------------------ texture ------------------------------ */

/** Film grain over the whole slide. Cheap, tileable, deterministic. */
export function grain(c: Ctx, amount = 0.045, color?: string): Node {
  return {
    kind: "noise",
    x: 0,
    y: 0,
    w: c.w,
    h: c.h,
    amount,
    cell: 2,
    seed: 1337,
    color: color ?? (c.pal.dark ? "#ffffff" : "#000000"),
  };
}

export function gridLines(c: Ctx, step = 60, color?: string, lineWidth = 1): Node[] {
  const col = color ?? withAlpha(c.pal.fg, c.pal.dark ? 0.07 : 0.05);
  const out: Node[] = [];
  for (let x = step; x < c.w; x += step)
    out.push({ kind: "line", x1: x, y1: 0, x2: x, y2: c.h, stroke: col, lineWidth });
  for (let y = step; y < c.h; y += step)
    out.push({ kind: "line", x1: 0, y1: y, x2: c.w, y2: y, stroke: col, lineWidth });
  return out;
}

export function dotGrid(c: Ctx, step = 44, r = 2, color?: string): Node[] {
  const col = color ?? withAlpha(c.pal.fg, 0.12);
  const out: Node[] = [];
  for (let y = step; y < c.h; y += step)
    for (let x = step; x < c.w; x += step)
      out.push({ kind: "ellipse", cx: x, cy: y, rx: r, ry: r, fill: col });
  return out;
}

/** Soft gradient "mesh" — the vector answer to an AI-generated background. */
export function meshBlobs(c: Ctx, colors: string[], count = 4): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < count; i++) {
    const cx = c.rand() * c.w;
    const cy = c.rand() * c.h;
    const r = c.w * (0.35 + c.rand() * 0.4);
    const col = colors[i % colors.length];
    out.push({
      kind: "ellipse",
      cx,
      cy,
      rx: r,
      ry: r * (0.7 + c.rand() * 0.5),
      fill: {
        type: "radial",
        cx,
        cy,
        r,
        stops: [
          { offset: 0, color: withAlpha(col, 0.55) },
          { offset: 0.55, color: withAlpha(col, 0.18) },
          { offset: 1, color: withAlpha(col, 0) },
        ],
      },
    });
  }
  return out;
}

/* ------------------------------ chrome ------------------------------- */

/** Slim progress bar pinned to the bottom edge. */
export function progressBar(c: Ctx, y?: number, height = 6): Node[] {
  const yy = y ?? c.h - height;
  const frac = c.total <= 1 ? 1 : (c.index + 1) / c.total;
  return [
    { kind: "rect", x: 0, y: yy, w: c.w, h: height, fill: withAlpha(c.pal.fg, 0.12) },
    { kind: "rect", x: 0, y: yy, w: c.w * frac, h: height, fill: c.pal.accent },
  ];
}

export function progressDots(c: Ctx, x: number, y: number, gap = 18, r = 5): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < c.total; i++) {
    out.push({
      kind: "ellipse",
      cx: x + i * gap,
      cy: y,
      rx: r,
      ry: r,
      fill: i === c.index ? c.pal.accent : withAlpha(c.pal.fg, 0.25),
    });
  }
  return out;
}

/** "03 / 09" counter. */
export function counter(c: Ctx, x: number, y: number, align: "left" | "right" = "left"): Node[] {
  const label = `${String(c.index + 1).padStart(2, "0")} / ${String(c.total).padStart(2, "0")}`;
  const b = fixedBlock(c, label, {
    x: align === "left" ? x : x - 200,
    y,
    w: 200,
    size: 22,
    font: c.fonts.mono,
    weight: 500,
    align,
    color: c.pal.muted,
    letterSpacing: 1,
  });
  return [b.node];
}

/** Bottom footer: handle on the left, swipe cue on the right. */
export function footer(c: Ctx, opts?: { color?: string; showSwipe?: boolean; y?: number }): Node[] {
  const color = opts?.color ?? c.pal.muted;
  const y = opts?.y ?? c.h - c.pad + 8;
  const out: Node[] = [];
  const handle = c.deck.handle?.trim();
  if (handle) {
    out.push(
      fixedBlock(c, handle, {
        x: c.pad,
        y,
        w: c.w / 2,
        size: 24,
        font: c.fonts.sans,
        weight: 600,
        color,
      }).node,
    );
  }
  const showSwipe = opts?.showSwipe ?? c.index < c.total - 1;
  if (showSwipe) {
    const label = "SWIPE";
    const size = 22;
    const tw = textWidth(c, label, c.fonts.sans, size, 700, 2);
    const arrowX = c.w - c.pad;
    out.push(
      fixedBlock(c, label, {
        x: arrowX - tw - 34,
        y: y + 1,
        w: tw + 4,
        size,
        font: c.fonts.sans,
        weight: 700,
        color,
        letterSpacing: 2,
      }).node,
      arrow(arrowX - 26, y + size * 0.62, 24, color, 2.5),
    );
  } else {
    out.push(...counter(c, c.w - c.pad, y, "right"));
  }
  return out;
}

export function arrow(
  x: number,
  y: number,
  len: number,
  color: string,
  width = 3,
  headSize?: number,
): Node {
  // The head is proportional for short arrows but capped, so a full-width
  // connector does not sprout a 300px chevron.
  const head = headSize ?? Math.min(len * 0.42, 22 + width * 2);
  return {
    kind: "path",
    d: `M ${x} ${y} L ${x + len} ${y} M ${x + len - head} ${y - head * 0.62} L ${x + len} ${y} L ${x + len - head} ${y + head * 0.62}`,
    stroke: color,
    lineWidth: width,
    cap: "round",
    join: "round",
  };
}

/* ------------------------------- chips -------------------------------- */

export interface Chip {
  nodes: Node[];
  w: number;
  h: number;
}

export function chip(
  c: Ctx,
  text: string,
  o: {
    x: number;
    y: number;
    size?: number;
    font?: string;
    weight?: number;
    fill?: Paint;
    color?: string;
    stroke?: string;
    radius?: number;
    padX?: number;
    padY?: number;
    uppercase?: boolean;
    letterSpacing?: number;
  },
): Chip {
  const size = o.size ?? 22;
  const font = o.font ?? c.fonts.sans;
  const weight = o.weight ?? 700;
  const ls = o.letterSpacing ?? 1.5;
  const label = o.uppercase === false ? text : text.toUpperCase();
  const padX = o.padX ?? size * 0.8;
  const padY = o.padY ?? size * 0.5;
  const tw = textWidth(c, label, font, size, weight, ls);
  const w = tw + padX * 2;
  const h = size * 1.25 + padY * 2;
  const nodes: Node[] = [
    {
      kind: "rect",
      x: o.x,
      y: o.y,
      w,
      h,
      r: o.radius ?? h / 2,
      fill: o.fill,
      stroke: o.stroke,
      lineWidth: o.stroke ? 2 : undefined,
    },
    fixedBlock(c, label, {
      x: o.x + padX,
      y: o.y + padY + size * 0.1,
      w: tw + 6,
      size,
      font,
      weight,
      color: o.color ?? c.pal.bg,
      letterSpacing: ls,
      marks: {},
    }).node,
  ];
  return { nodes, w, h };
}

/** Numbered circle used by framework / step presets. */
export function numberBadge(
  c: Ctx,
  n: number | string,
  x: number,
  y: number,
  r: number,
  o?: { fill?: Paint; color?: string; stroke?: string; font?: string },
): Node[] {
  const size = r * 1.05;
  const label = String(n);
  const tw = textWidth(c, label, o?.font ?? c.fonts.sans, size, 800);
  return [
    {
      kind: "ellipse",
      cx: x,
      cy: y,
      rx: r,
      ry: r,
      fill: o?.fill ?? c.pal.accent,
      stroke: o?.stroke,
      lineWidth: o?.stroke ? 3 : undefined,
    },
    fixedBlock(c, label, {
      x: x - tw / 2,
      y: y - size * 0.62,
      w: tw + 8,
      size,
      font: o?.font ?? c.fonts.sans,
      weight: 800,
      color: o?.color ?? c.pal.bg,
      marks: {},
    }).node,
  ];
}

export function checkbox(
  c: Ctx,
  x: number,
  y: number,
  size: number,
  checked: boolean,
  o?: { color?: string; check?: string; radius?: number },
): Node[] {
  const color = o?.color ?? c.pal.fg;
  const nodes: Node[] = [
    {
      kind: "rect",
      x,
      y,
      w: size,
      h: size,
      r: o?.radius ?? size * 0.22,
      stroke: checked ? (o?.check ?? c.pal.accent) : withAlpha(color, 0.45),
      lineWidth: 3,
      fill: checked ? (o?.check ?? c.pal.accent) : undefined,
    },
  ];
  if (checked) {
    const p = size * 0.24;
    nodes.push({
      kind: "path",
      d: `M ${x + p} ${y + size * 0.52} L ${x + size * 0.42} ${y + size - p} L ${x + size - p} ${y + p * 1.15}`,
      stroke: c.pal.dark ? "#000000" : "#ffffff",
      lineWidth: size * 0.12,
      cap: "round",
      join: "round",
    });
  }
  return nodes;
}

export function stars(c: Ctx, x: number, y: number, size: number, filled: number, total = 5): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < total; i++) {
    const cx = x + i * size * 1.25 + size / 2;
    out.push({
      kind: "path",
      d: starPath(cx, y + size / 2, size / 2, size / 4.4),
      fill: i < filled ? c.pal.accent : withAlpha(c.pal.fg, 0.18),
    });
  }
  return out;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"} ${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r} `;
  }
  return `${d}Z`;
}

/* ------------------------------- charts ------------------------------- */

export function barChart(
  c: Ctx,
  box: { x: number; y: number; w: number; h: number },
  values: number[],
  o?: { color?: string; highlight?: number; gap?: number; radius?: number; baseline?: string },
): Node[] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 1);
  const gap = o?.gap ?? box.w * 0.03;
  const bw = (box.w - gap * (values.length - 1)) / values.length;
  const out: Node[] = [];
  values.forEach((v, i) => {
    const h = Math.max(4, (v / max) * box.h);
    const x = box.x + i * (bw + gap);
    out.push({
      kind: "rect",
      x,
      y: box.y + box.h - h,
      w: bw,
      h,
      r: o?.radius ?? Math.min(bw / 2, 10),
      fill:
        o?.highlight === i
          ? (o?.color ?? c.pal.accent)
          : withAlpha(o?.baseline ?? c.pal.fg, 0.22),
    });
  });
  return out;
}

export function sparkline(
  c: Ctx,
  box: { x: number; y: number; w: number; h: number },
  values: number[],
  o?: { color?: string; width?: number; fill?: boolean; dot?: boolean },
): Node[] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    box.x + (i / (values.length - 1)) * box.w,
    box.y + box.h - ((v - min) / span) * box.h,
  ]);
  const color = o?.color ?? c.pal.accent;
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  const out: Node[] = [];
  if (o?.fill) {
    out.push({
      kind: "path",
      d: `${d} L ${box.x + box.w} ${box.y + box.h} L ${box.x} ${box.y + box.h} Z`,
      fill: withAlpha(color, 0.16),
    });
  }
  out.push({
    kind: "path",
    d,
    stroke: color,
    lineWidth: o?.width ?? 5,
    cap: "round",
    join: "round",
  });
  if (o?.dot !== false) {
    const last = pts[pts.length - 1];
    out.push({ kind: "ellipse", cx: last[0], cy: last[1], rx: 9, ry: 9, fill: color });
  }
  return out;
}

export function donut(
  c: Ctx,
  cx: number,
  cy: number,
  r: number,
  fraction: number,
  o?: { color?: string; track?: string; width?: number },
): Node[] {
  const width = o?.width ?? r * 0.28;
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * Math.min(1, Math.max(0.001, fraction));
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p0 = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r];
  const p1 = [cx + Math.cos(a1) * r, cy + Math.sin(a1) * r];
  return [
    {
      kind: "ellipse",
      cx,
      cy,
      rx: r,
      ry: r,
      stroke: o?.track ?? withAlpha(c.pal.fg, 0.15),
      lineWidth: width,
    },
    {
      kind: "path",
      d: `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]}`,
      stroke: o?.color ?? c.pal.accent,
      lineWidth: width,
      cap: "round",
    },
  ];
}

/* ---------------------------- hand-drawn ------------------------------ */

/** Wobbly polyline through points — the "drawn by a human" primitive. */
export function sketchLine(
  c: Ctx,
  pts: [number, number][],
  jitter = 4,
): string {
  let d = "";
  pts.forEach(([x, y], i) => {
    const jx = (c.rand() - 0.5) * jitter;
    const jy = (c.rand() - 0.5) * jitter;
    d += `${i === 0 ? "M" : "L"} ${x + jx} ${y + jy} `;
  });
  return d.trim();
}

export function sketchUnderline(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  color: string,
  width = 8,
): Node[] {
  const pts: [number, number][] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) pts.push([x + (w * i) / steps, y]);
  return [
    { kind: "path", d: sketchLine(c, pts, 7), stroke: color, lineWidth: width, cap: "round" },
    {
      kind: "path",
      d: sketchLine(c, pts.map(([px, py]) => [px + 4, py + 7] as [number, number]), 5),
      stroke: withAlpha(color, 0.5),
      lineWidth: width * 0.55,
      cap: "round",
    },
  ];
}

export function sketchCircle(
  c: Ctx,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: string,
  width = 7,
): Node {
  const pts: [number, number][] = [];
  const steps = 26;
  for (let i = 0; i <= steps + 3; i++) {
    const a = (i / steps) * Math.PI * 2 - 0.6;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return { kind: "path", d: sketchLine(c, pts, 9), stroke: color, lineWidth: width, cap: "round" };
}

/** Curved connector with an arrowhead — for whiteboard / framework presets. */
export function curvedArrow(
  from: [number, number],
  to: [number, number],
  bow: number,
  color: string,
  width = 4,
): Node[] {
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bow;
  const cy = my + ny * bow;
  const ang = Math.atan2(to[1] - cy, to[0] - cx);
  const head = 18;
  const a1 = ang + Math.PI * 0.82;
  const a2 = ang - Math.PI * 0.82;
  return [
    {
      kind: "path",
      d: `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`,
      stroke: color,
      lineWidth: width,
      cap: "round",
    },
    {
      kind: "path",
      d: `M ${to[0] + Math.cos(a1) * head} ${to[1] + Math.sin(a1) * head} L ${to[0]} ${to[1]} L ${to[0] + Math.cos(a2) * head} ${to[1] + Math.sin(a2) * head}`,
      stroke: color,
      lineWidth: width,
      cap: "round",
      join: "round",
    },
  ];
}

/* ---------------------------- props / paper --------------------------- */

export function tape(c: Ctx, x: number, y: number, w: number, angle: number, color?: string): Node {
  return {
    kind: "rect",
    x,
    y,
    w,
    h: 42,
    fill: color ?? withAlpha(c.pal.dark ? "#ffffff" : "#d9c98f", 0.45),
    rotate: angle,
    origin: [x + w / 2, y + 21],
  };
}

/** Torn/perforated edge across a horizontal line. */
export function perforation(c: Ctx, y: number, r = 12, color?: string): Node[] {
  const out: Node[] = [];
  const step = r * 2.6;
  for (let x = 0; x <= c.w + step; x += step) {
    out.push({ kind: "ellipse", cx: x, cy: y, rx: r, ry: r, fill: color ?? c.pal.bg });
  }
  return out;
}

export function barcode(c: Ctx, x: number, y: number, w: number, h: number, color?: string): Node[] {
  const out: Node[] = [];
  let cx = x;
  const col = color ?? c.pal.fg;
  while (cx < x + w) {
    const bw = 2 + Math.floor(c.rand() * 6);
    if (cx + bw > x + w) break;
    if (c.rand() > 0.35) out.push({ kind: "rect", x: cx, y, w: bw, h, fill: col });
    cx += bw + 2 + Math.floor(c.rand() * 4);
  }
  return out;
}

/** Rounded panel with a soft drop shadow — the generic "card". */
export function card(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o?: { fill?: Paint; radius?: number; shadow?: boolean; stroke?: string; lineWidth?: number; rotate?: number },
): Node {
  return {
    kind: "rect",
    x,
    y,
    w,
    h,
    r: o?.radius ?? 28,
    fill: o?.fill ?? c.pal.surface,
    stroke: o?.stroke,
    lineWidth: o?.lineWidth ?? (o?.stroke ? 2 : undefined),
    rotate: o?.rotate,
    shadow:
      o?.shadow === false
        ? undefined
        : {
            color: withAlpha(c.pal.dark ? "#000000" : "#1b1b1b", c.pal.dark ? 0.55 : 0.14),
            blur: 42,
            x: 0,
            y: 16,
          },
  };
}

/** Initials avatar — a face without an image model. */
export function avatar(
  c: Ctx,
  name: string,
  x: number,
  y: number,
  r: number,
  o?: { fill?: string; color?: string },
): Node[] {
  const initials = name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  const fill = o?.fill ?? mix(c.pal.accent, c.pal.bg, 0.25);
  const size = r * 0.85;
  const tw = textWidth(c, initials, c.fonts.sans, size, 700);
  return [
    { kind: "ellipse", cx: x, cy: y, rx: r, ry: r, fill },
    fixedBlock(c, initials, {
      x: x - tw / 2,
      y: y - size * 0.6,
      w: tw + 8,
      size,
      font: c.fonts.sans,
      weight: 700,
      color: o?.color ?? (c.pal.dark ? "#0a0a0a" : "#ffffff"),
      marks: {},
    }).node,
  ];
}

/** Big opening quotation mark drawn as type. */
export function quoteGlyph(c: Ctx, x: number, y: number, size: number, color?: string): Node {
  return fixedBlock(c, "“", {
    x,
    y,
    w: size * 2,
    size,
    font: c.fonts.serif,
    weight: 700,
    color: color ?? withAlpha(c.pal.accent, 0.9),
    lineHeight: 1,
    marks: {},
  }).node;
}
