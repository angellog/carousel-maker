import { withAlpha } from "../theme";
import type { Ctx } from "../render/ctx";
import { fixedBlock, textWidth } from "../render/ctx";
import type { Node, Paint } from "../render/scene";

/**
 * A reusable hand-drawn / illustrative element library shared by the six
 * "illustrated" templates (notebook, editorial, sticker-pop, infographic,
 * storyboard, scrapbook). It complements `render/decor.ts` (which already ships
 * arrows, stars, sketch strokes, charts, tape, cards) with the small
 * decorative marks a social-media design studio reaches for: sparkles, bursts,
 * speech bubbles, sticky notes, badges, marker highlights, hand-drawn frames
 * and rubber stamps.
 *
 * Everything here is a pure vector/type node — no image model is consulted.
 * Functions take explicit coordinates so a template can place a mark precisely
 * in a margin or corner and never over its own text. The `scatter*` helpers use
 * `c.rand` (deterministic per slide) so decoration never flickers between
 * renders of the same slide.
 */

/* ------------------------------ primitives ---------------------------- */

/** A four-point "sparkle" — the ubiquitous social accent. */
export function sparkle(cx: number, cy: number, size: number, color: string): Node {
  const s = size;
  const t = size * 0.32; // waist
  const d =
    `M ${cx} ${cy - s} ` +
    `C ${cx + t} ${cy - t} ${cx + t} ${cy - t} ${cx + s} ${cy} ` +
    `C ${cx + t} ${cy + t} ${cx + t} ${cy + t} ${cx} ${cy + s} ` +
    `C ${cx - t} ${cy + t} ${cx - t} ${cy + t} ${cx - s} ${cy} ` +
    `C ${cx - t} ${cy - t} ${cx - t} ${cy - t} ${cx} ${cy - s} Z`;
  return { kind: "path", d, fill: color };
}

/** A five-point star, filled or outlined. */
export function star5(
  cx: number,
  cy: number,
  r: number,
  color: string,
  o?: { fill?: boolean; width?: number; rot?: number },
): Node {
  const inner = r * 0.42;
  const rot = o?.rot ?? -Math.PI / 2;
  let d = "";
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = (Math.PI / 5) * i + rot;
    d += `${i === 0 ? "M" : "L"} ${cx + Math.cos(a) * rad} ${cy + Math.sin(a) * rad} `;
  }
  d += "Z";
  return o?.fill === false
    ? { kind: "path", d, stroke: color, lineWidth: o?.width ?? 3, join: "round" }
    : { kind: "path", d, fill: color };
}

/** A little starburst / "pop" ring of rays — sits behind a number or badge. */
export function burst(cx: number, cy: number, r: number, color: string, rays = 10, width = 4): Node[] {
  const out: Node[] = [];
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    const r0 = r * 0.62;
    out.push({
      kind: "line",
      x1: cx + Math.cos(a) * r0,
      y1: cy + Math.sin(a) * r0,
      x2: cx + Math.cos(a) * r,
      y2: cy + Math.sin(a) * r,
      stroke: color,
      lineWidth: width,
      cap: "round",
    });
  }
  return out;
}

/** A single spark/twinkle: a plus with short diagonal ticks. */
export function twinkle(cx: number, cy: number, size: number, color: string, width = 3): Node {
  const s = size;
  const d =
    `M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx} ${cy - s} L ${cx} ${cy + s}`;
  return { kind: "path", d, stroke: color, lineWidth: width, cap: "round" };
}

/** A heart. */
export function heart(cx: number, cy: number, size: number, color: string): Node {
  const s = size;
  const d =
    `M ${cx} ${cy + s * 0.7} ` +
    `C ${cx - s * 1.3} ${cy - s * 0.2} ${cx - s * 0.5} ${cy - s} ${cx} ${cy - s * 0.35} ` +
    `C ${cx + s * 0.5} ${cy - s} ${cx + s * 1.3} ${cy - s * 0.2} ${cx} ${cy + s * 0.7} Z`;
  return { kind: "path", d, fill: color };
}

/** A lightning bolt. */
export function bolt(cx: number, cy: number, size: number, color: string): Node {
  const s = size;
  const d =
    `M ${cx + s * 0.2} ${cy - s} L ${cx - s * 0.5} ${cy + s * 0.15} ` +
    `L ${cx} ${cy + s * 0.15} L ${cx - s * 0.2} ${cy + s} ` +
    `L ${cx + s * 0.55} ${cy - s * 0.2} L ${cx} ${cy - s * 0.2} Z`;
  return { kind: "path", d, fill: color };
}

/** A hand-drawn wobble rectangle (four jittered strokes), used as a frame. */
export function handBox(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  width = 4,
): Node {
  const j = () => (c.rand() - 0.5) * 6;
  const d =
    `M ${x + j()} ${y + j()} L ${x + w + j()} ${y + j()} ` +
    `L ${x + w + j()} ${y + h + j()} L ${x + j()} ${y + h + j()} Z`;
  return { kind: "path", d, stroke: color, lineWidth: width, join: "round", cap: "round" };
}

/** An angled marker-highlight swash sized to sit behind a run of text. */
export function highlightStroke(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  o?: { rotate?: number; radius?: number },
): Node {
  return {
    kind: "rect",
    x,
    y,
    w,
    h,
    r: o?.radius ?? h * 0.28,
    fill: withAlpha(color, 0.32),
    rotate: o?.rotate ?? -0.012,
    origin: [x + w / 2, y + h / 2],
  };
}

/** A rounded speech bubble with a tail. Returns the shell (fill under text). */
export function speechBubble(
  x: number,
  y: number,
  w: number,
  h: number,
  o?: {
    fill?: Paint;
    stroke?: string;
    lineWidth?: number;
    radius?: number;
    tail?: "bl" | "br" | "tl" | "tr" | "none";
    tailSize?: number;
  },
): Node[] {
  const r = o?.radius ?? Math.min(28, h * 0.4);
  const t = o?.tailSize ?? 26;
  const nodes: Node[] = [
    {
      kind: "rect",
      x,
      y,
      w,
      h,
      r,
      fill: o?.fill,
      stroke: o?.stroke,
      lineWidth: o?.stroke ? (o?.lineWidth ?? 3) : undefined,
    },
  ];
  const tail = o?.tail ?? "bl";
  if (tail !== "none") {
    const bottom = tail === "bl" || tail === "br";
    const left = tail === "bl" || tail === "tl";
    const ty = bottom ? y + h : y;
    const tx = left ? x + r + 12 : x + w - r - 12 - t;
    const dir = bottom ? 1 : -1;
    const d = `M ${tx} ${ty} L ${tx + t * 0.55} ${ty + dir * t} L ${tx + t} ${ty} Z`;
    nodes.push({
      kind: "path",
      d,
      fill: o?.fill,
      stroke: o?.stroke,
      lineWidth: o?.stroke ? (o?.lineWidth ?? 3) : undefined,
    });
  }
  return nodes;
}

/** A sticky note (square-ish) with a soft shadow and slight rotation. */
export function stickyNote(
  c: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  o?: { rotate?: number; shadow?: boolean },
): Node {
  return {
    kind: "rect",
    x,
    y,
    w,
    h,
    r: 4,
    fill: color,
    rotate: o?.rotate ?? 0,
    origin: [x + w / 2, y + h / 2],
    shadow:
      o?.shadow === false
        ? undefined
        : { color: withAlpha("#000000", c.pal.dark ? 0.4 : 0.16), blur: 24, x: 0, y: 10 },
  };
}

/** A circular rubber stamp — ring plus centred word, slightly rotated. */
export function stamp(
  c: Ctx,
  cx: number,
  cy: number,
  r: number,
  text: string,
  color: string,
  o?: { rotate?: number; font?: string },
): Node[] {
  const label = text.toUpperCase();
  const size = Math.min(r * 0.42, (r * 1.5) / Math.max(1, label.length) / 0.55);
  const font = o?.font ?? c.fonts.mono;
  const tw = textWidth(c, label, font, size, 800, 2);
  const rot = o?.rotate ?? -0.14;
  const origin: [number, number] = [cx, cy];
  return [
    { kind: "ellipse", cx, cy, rx: r, ry: r, stroke: color, lineWidth: 4, rotate: rot, origin },
    { kind: "ellipse", cx, cy, rx: r - 9, ry: r - 9, stroke: withAlpha(color, 0.6), lineWidth: 2, rotate: rot, origin },
    {
      ...fixedBlock(c, label, {
        x: cx - tw / 2,
        y: cy - size * 0.62,
        w: tw + 8,
        size,
        font,
        weight: 800,
        color,
        letterSpacing: 2,
        marks: {},
      }).node,
      rotate: rot,
      origin,
    },
  ];
}

/** A small handwritten label tag (no chip background), for margin notes. */
export function handLabel(
  c: Ctx,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  o?: { align?: "left" | "center" | "right"; w?: number; rotate?: number },
): Node {
  const w = o?.w ?? size * text.length * 0.62 + 20;
  const node = fixedBlock(c, text, {
    x,
    y,
    w,
    size,
    font: c.fonts.hand,
    weight: 700,
    color,
    align: o?.align ?? "left",
    lineHeight: 1.1,
    marks: {},
  }).node;
  return o?.rotate ? { ...node, rotate: o.rotate, origin: [x + w / 2, y + size / 2] } : node;
}

/** A dotted/dashed connector path between two points with a slight bow. */
export function dottedConnector(
  from: [number, number],
  to: [number, number],
  color: string,
  o?: { bow?: number; width?: number; dash?: number[] },
): Node {
  const bow = o?.bow ?? 0;
  const mx = (from[0] + to[0]) / 2;
  const my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bow;
  const cy = my + (dx / len) * bow;
  return {
    kind: "path",
    d: `M ${from[0]} ${from[1]} Q ${cx} ${cy} ${to[0]} ${to[1]}`,
    stroke: color,
    lineWidth: o?.width ?? 3,
    dash: o?.dash ?? [2, 10],
    cap: "round",
  };
}

/** A simple outlined "blob" organic shape (used as an illustration ground). */
export function blob(cx: number, cy: number, r: number, seed: () => number, fill: Paint): Node {
  const pts = 8;
  let d = "";
  const first: [number, number] = [0, 0];
  const coords: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (Math.PI * 2 * i) / pts;
    const rr = r * (0.78 + seed() * 0.32);
    coords.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  coords.forEach((p, i) => {
    if (i === 0) {
      first[0] = p[0];
      first[1] = p[1];
      d += `M ${p[0]} ${p[1]} `;
    } else {
      const prev = coords[i - 1];
      const mx = (prev[0] + p[0]) / 2;
      const my = (prev[1] + p[1]) / 2;
      d += `Q ${prev[0]} ${prev[1]} ${mx} ${my} `;
    }
  });
  const last = coords[coords.length - 1];
  const mx = (last[0] + first[0]) / 2;
  const my = (last[1] + first[1]) / 2;
  d += `Q ${last[0]} ${last[1]} ${mx} ${my} Z`;
  return { kind: "path", d, fill };
}

/* ------------------------------ contextual --------------------------- */

/** The doodle vocabulary keyed to what a slide is *about*. */
export type Motif = "spark" | "star" | "heart" | "bolt" | "arrow" | "check" | "twinkle";

/** Which small accents suit a slide, inferred from its role and content. */
export function motifsFor(c: Ctx): Motif[] {
  const s = c.slide;
  if (s.role === "cta") return ["spark", "star", "arrow"];
  if (s.role === "cover") return ["spark", "star", "twinkle"];
  if (s.stat) return ["spark", "bolt", "twinkle"];
  if (s.compare) return ["bolt", "check", "spark"];
  if (s.steps) return ["arrow", "check", "spark"];
  if (s.quote) return ["spark", "heart", "twinkle"];
  if (s.bullets || s.items) return ["check", "spark", "star"];
  return ["spark", "twinkle", "star"];
}

/** Draw one motif mark at a point. */
export function motifMark(motif: Motif, cx: number, cy: number, size: number, color: string): Node[] {
  switch (motif) {
    case "spark":
      return [sparkle(cx, cy, size, color)];
    case "star":
      return [star5(cx, cy, size, color)];
    case "heart":
      return [heart(cx, cy, size, color)];
    case "bolt":
      return [bolt(cx, cy, size, color)];
    case "twinkle":
      return [twinkle(cx, cy, size * 0.9, color, Math.max(2.5, size * 0.16))];
    case "arrow":
      return [
        {
          kind: "path",
          d: `M ${cx - size} ${cy} L ${cx + size} ${cy} M ${cx + size * 0.4} ${cy - size * 0.5} L ${cx + size} ${cy} L ${cx + size * 0.4} ${cy + size * 0.5}`,
          stroke: color,
          lineWidth: Math.max(2.5, size * 0.18),
          cap: "round",
          join: "round",
        },
      ];
    case "check":
      return [
        {
          kind: "path",
          d: `M ${cx - size} ${cy} L ${cx - size * 0.25} ${cy + size * 0.7} L ${cx + size} ${cy - size * 0.7}`,
          stroke: color,
          lineWidth: Math.max(3, size * 0.22),
          cap: "round",
          join: "round",
        },
      ];
  }
}

/**
 * Scatter a few contextual accents into the outer margins of the frame so they
 * decorate without ever touching the content column. `keepOut` is the text box;
 * marks only land in the gutters around it.
 */
export function scatterAccents(
  c: Ctx,
  keepOut: { x: number; y: number; w: number; h: number },
  colors: string[],
  o?: { count?: number; min?: number; max?: number },
): Node[] {
  const motifs = motifsFor(c);
  const count = o?.count ?? 5;
  const min = o?.min ?? 12;
  const max = o?.max ?? 24;
  const out: Node[] = [];
  const pad = c.pad;
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < count * 12) {
    guard++;
    const x = pad * 0.4 + c.rand() * (c.w - pad * 0.8);
    const y = pad * 0.4 + c.rand() * (c.h - pad * 0.8);
    // Reject points inside the protected content box (with a margin).
    const m = 30;
    if (x > keepOut.x - m && x < keepOut.x + keepOut.w + m && y > keepOut.y - m && y < keepOut.y + keepOut.h + m) {
      continue;
    }
    const motif = motifs[placed % motifs.length];
    const size = min + c.rand() * (max - min);
    const color = colors[placed % colors.length];
    out.push(...motifMark(motif, x, y, size, color));
    placed++;
  }
  return out;
}
