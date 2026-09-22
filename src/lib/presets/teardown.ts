import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, stack, textWidth } from "../render/ctx";
import type { Node, Paint } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyBox,
  bodyPart,
  chatPart,
  comparePart,
  bulletsPart,
  defaultShell,
  itemsPart,
  kickerPart,
  scene,
  statPart,
  stepsPart,
  titlePart,
  D,
  type Part,
  type ShellStyle,
} from "./_shared";
import * as Do from "./_doodles";
import type { Preset } from "./types";

/**
 * "Teardown" — a rust-on-cream editorial playbook, the format money/business
 * how-to carousels use: a heavy headline with colour-pop keywords, an orange
 * uppercase kicker, a hand-drawn underline under the phrase that matters, a big
 * ghost index number, and one "hero object" per slide. The object is real UI,
 * never a generated image: a chat becomes a bubble mockup, a stat/list becomes
 * a figure card, and everything else gets a flat vector app-tile ringed with
 * hand-drawn pop lines. Zero image models.
 */

function placed(parts: (Part | null)[], box: Box, gap: number, justify: ShellStyle["justify"]): { part: Part; y: number }[] {
  const live = parts.filter((p): p is Part => !!p);
  if (live.length === 0) return [];
  const ys = stack(box.y, box.h, live.map((p) => p.h), gap, justify);
  return live.map((p, i) => ({ part: p, y: ys[i] }));
}

/** A flat vector "app tile" with a highlight sweep and hand-drawn pop lines. */
function appTile(c: Ctx, cx: number, cy: number, size: number, accent: string): Node[] {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const r = size * 0.26;
  const grad: Paint = {
    type: "linear",
    x0: x,
    y0: y,
    x1: x + size,
    y1: y + size,
    stops: [
      { offset: 0, color: mix(accent, "#ffffff", 0.28) },
      { offset: 1, color: mix(accent, "#000000", 0.12) },
    ],
  };
  const out: Node[] = [
    { kind: "rect", x, y, w: size, h: size, r, fill: grad, shadow: { color: withAlpha("#000000", 0.28), blur: 40, x: 0, y: 20 } },
    // highlight sweep, clipped to the tile
    {
      kind: "group",
      clip: { x, y, w: size, h: size, r },
      children: [{ kind: "ellipse", cx: x + size * 0.32, cy: y + size * 0.24, rx: size * 0.55, ry: size * 0.32, fill: withAlpha("#ffffff", 0.22) }],
    },
    // a white speech-bubble glyph
    ...Do.speechBubble(x + size * 0.26, y + size * 0.3, size * 0.48, size * 0.34, { fill: "#ffffff", tail: "bl", radius: size * 0.12, tailSize: size * 0.12 }),
    { kind: "ellipse", cx: x + size * 0.42, cy: y + size * 0.47, rx: size * 0.03, ry: size * 0.03, fill: accent },
    { kind: "ellipse", cx: x + size * 0.5, cy: y + size * 0.47, rx: size * 0.03, ry: size * 0.03, fill: accent },
    { kind: "ellipse", cx: x + size * 0.58, cy: y + size * 0.47, rx: size * 0.03, ry: size * 0.03, fill: accent },
  ];
  // hand-drawn pop lines off the top-right (the reference's motion accent)
  const pcx = x + size + 18;
  const pcy = y + size * 0.2;
  for (let i = 0; i < 4; i++) {
    const a = -0.9 + i * 0.5;
    const r0 = 18;
    const r1 = 46;
    out.push({
      kind: "path",
      d: D.sketchLine(c, [
        [pcx + Math.cos(a) * r0, pcy + Math.sin(a) * r0],
        [pcx + Math.cos(a) * r1, pcy + Math.sin(a) * r1],
      ], 3),
      stroke: accent,
      lineWidth: 5,
      cap: "round",
    });
  }
  return out;
}

/** A chat mockup inside a white card with a messenger-style header bar. */
function chatHero(c: Ctx, s: ShellStyle, region: Box, accent: string, ink: string): Node[] | null {
  const turns = c.slide.chat;
  if (!turns || turns.length === 0) return null;
  const pad = 24;
  const headerH = 64;
  const inner: Box = { x: region.x + 14, y: region.y + pad + headerH, w: region.w - 28, h: region.h - pad * 2 - headerH };
  if (inner.h < 60) return null;
  const chat = chatPart(c, s, inner, { mine: "#d9fdd3", mineText: "#0b2e13", theirs: mix(c.pal.bg, "#ffffff", 0.55), theirsText: ink });
  if (!chat) return null;
  const cx = region.x - 6;
  const cy = region.y - 4;
  const cw = region.w + 12;
  const cardH = Math.min(region.h, headerH + chat.h + pad * 2);
  const out: Node[] = [
    D.card(c, cx, cy, cw, cardH, { fill: c.pal.surface, radius: 24, shadow: true }),
    { kind: "rect", x: cx, y: cy, w: cw, h: headerH, r: [24, 24, 0, 0], fill: mix(c.pal.surface, ink, 0.05) },
    { kind: "ellipse", cx: cx + 42, cy: cy + headerH / 2, rx: 17, ry: 17, fill: mix(accent, "#ffffff", 0.15) },
    fixedBlock(c, "Assistant", { x: cx + 72, y: cy + 12, w: cw - 140, size: 24, font: c.fonts.sans, weight: 700, color: ink, marks: {} }).node,
    fixedBlock(c, "online · replies in seconds", { x: cx + 72, y: cy + 38, w: cw - 140, size: 17, font: c.fonts.sans, weight: 500, color: c.pal.muted, marks: {} }).node,
    { kind: "ellipse", cx: cx + cw - 34, cy: cy + headerH / 2, rx: 7, ry: 7, fill: "#22c55e" },
  ];
  out.push(...chat.draw(region.y + pad + headerH));
  return out;
}

/** A horizontal equation strip ("10 × $1,000 = $10,000") inside a white card. */
function equationHero(c: Ctx, region: Box, items: { label: string; value: string }[], accent: string, ink: string): Node[] | null {
  const n = items.length;
  const ops = n === 3 ? ["×", "="] : n === 2 ? ["="] : [];
  if (ops.length === 0) return null;
  const opW = 56;
  const cellW = (region.w - opW * ops.length) / n;
  if (cellW < 90) return null;
  const pad = 22;
  const cellH = Math.min(160, region.h - pad * 2);
  if (cellH < 90) return null;
  const cardH = Math.min(region.h, cellH + pad * 2);
  const out: Node[] = [D.card(c, region.x - 6, region.y - 4, region.w + 12, cardH, { fill: c.pal.surface, radius: 24, shadow: true })];
  let x = region.x;
  const y = region.y + pad;
  items.forEach((it, i) => {
    const hi = i === n - 1;
    out.push({
      kind: "rect",
      x: x + 6,
      y,
      w: cellW - 12,
      h: cellH,
      r: 16,
      fill: hi ? withAlpha(accent, 0.14) : withAlpha(ink, 0.05),
      stroke: hi ? withAlpha(accent, 0.45) : undefined,
      lineWidth: hi ? 2 : undefined,
    });
    const val = it.value || "";
    const vsize = Math.max(28, Math.min(56, ((cellW - 36) * 0.92) / Math.max(1, val.length) / 0.6));
    out.push(fixedBlock(c, val, { x: x + 6, y: y + cellH * 0.22, w: cellW - 12, size: vsize, font: c.fonts.sans, weight: 800, color: hi ? accent : ink, align: "center", letterSpacing: -1, marks: {} }).node);
    out.push(fixedBlock(c, it.label || "", { x: x + 6, y: y + cellH * 0.66, w: cellW - 12, size: 20, font: c.fonts.sans, weight: 500, color: c.pal.muted, align: "center", marks: {} }).node);
    if (i < n - 1) {
      out.push(fixedBlock(c, ops[i], { x: x + cellW, y: y + cellH * 0.3, w: opW, size: 42, font: c.fonts.sans, weight: 800, color: accent, align: "center", marks: {} }).node);
    }
    x += cellW + opW;
  });
  return out;
}

export const teardown: Preset = {
  id: "teardown",
  name: "Teardown",
  category: "editorial",
  blurb: "Rust-on-cream playbook — heavy colour-pop headline, hand underline, a ghost index and one real-UI hero.",
  defaultPalette: "parchment",
  palettes: ["parchment", "clay", "cream", "sunset"],
  needs: ["kicker", "body", "chat", "stat", "items", "steps"],
  brief:
    "A money/business teardown. An orange uppercase `kicker` label, a heavy headline (4-9 words) with one or two strong words wrapped in **bold** so they pop, and a short supporting line. Give each slide one concrete object: a `chat` for a conversation, a `stat` or `items` for the numbers, `steps` for the process. Confident, specific, no fluff.",
  slideRange: [6, 12],
  pad: 92,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    const ink = c.pal.fg;
    nodes.push({ kind: "rect", x: 0, y: 0, w: c.w, h: c.h, fill: c.pal.bg });

    const box = bodyBox(c, 108);

    // Ghost index number, top-right (overlaid, reserves no space).
    const idx = String(c.index + 1).padStart(2, "0");
    nodes.push(
      fixedBlock(c, idx, {
        x: box.x + box.w - 220,
        y: box.y - 18,
        w: 220,
        size: 96,
        font: c.fonts.sans,
        weight: 800,
        color: withAlpha(ink, 0.08),
        align: "right",
        letterSpacing: -2,
        marks: {},
      }).node,
    );
    // Small index tick in accent (like the reference's "01").
    nodes.push(
      fixedBlock(c, idx, {
        x: box.x,
        y: box.y - 8,
        w: 120,
        size: 30,
        font: c.fonts.sans,
        weight: 800,
        color: accent,
        marks: {},
      }).node,
      { kind: "line", x1: box.x + 2, y1: box.y + 34, x2: box.x + 44, y2: box.y + 34, stroke: accent, lineWidth: 4, cap: "round" },
    );

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 22,
      kickerFont: "sans",
      kickerWeight: 800,
      kickerSize: 24,
      kickerLS: 3,
      kickerUpper: true,
      kickerColor: accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 104,
      titleMin: 44,
      titleLH: 1.02,
      titleLS: -1.5,
      titleColor: ink,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: withAlpha(ink, 0.72),
    });

    // Header sits below the accent index tick.
    const header: Box = { x: box.x, y: box.y + 58, w: box.w, h: box.h - 58 };
    const kick = kickerPart(c, s, header);
    const title = titlePart(c, s, header, undefined, header.h * 0.42);
    const bodyP = bodyPart(c, s, header);
    const headPlaced = placed([kick, title, bodyP], header, s.gap, "start");
    for (const { part, y } of headPlaced) nodes.push(...part.draw(y));

    // Hand-drawn underline beneath the title's last line.
    const tEntry = headPlaced.find((e) => e.part === title);
    if (title && tEntry) {
      // Re-measure the title block to find its last line width.
      const tb = block(c, c.slide.title || " ", {
        x: header.x, y: 0, w: header.w, maxH: header.h * 0.42, font: c.fonts.sans, weight: 800,
        max: 104, min: 44, lineHeight: 1.02, align: "left", color: ink, letterSpacing: -1.5, marks: s.marks,
      });
      const lines = tb.node.lines;
      const last = lines[lines.length - 1];
      if (last) {
        const w = Math.min(header.w, Math.max(80, last.width * 0.9));
        const lineY = tEntry.y + (lines.length - 1) * tb.size * tb.node.lineHeight + tb.size * 1.02;
        nodes.push(...D.sketchUnderline(c, header.x, lineY, w, accent, 7));
      }
    }

    // Hero object region — the remaining space under the header.
    const headBottom = headPlaced.length
      ? Math.max(...headPlaced.map((e) => e.y + e.part.h)) + 46
      : header.y;
    const region: Box = { x: box.x, y: headBottom, w: box.w, h: box.y + box.h - headBottom };

    if (region.h > 120) {
      // A chat gets a messenger card; two or three items become an equation
      // strip; other structured fields render in a plain white card; a bare
      // cover/CTA gets the vector app-tile.
      const custom =
        chatHero(c, s, region, accent, ink) ??
        (c.slide.items && (c.slide.items.length === 2 || c.slide.items.length === 3)
          ? equationHero(c, region, c.slide.items, accent, ink)
          : null);
      if (custom) {
        nodes.push(...custom);
      } else {
        const hero =
          statPart(c, s, region, { valueColor: accent }) ??
          itemsPart(c, s, region) ??
          stepsPart(c, s, region) ??
          comparePart(c, s, region) ??
          bulletsPart(c, s, region);
        if (hero) {
          const pad = 30;
          const cardH = Math.min(region.h, hero.h + pad * 2);
          nodes.push(D.card(c, region.x - 6, region.y - 4, region.w + 12, cardH, { fill: c.pal.surface, radius: 24, shadow: true }));
          nodes.push(...hero.draw(region.y + pad));
        } else {
          // No structured field (cover / CTA): the flat vector app-tile.
          const size = Math.min(region.w * 0.62, region.h * 0.82, 340);
          appTile(c, region.x + region.w - size / 2 - 10, region.y + region.h / 2, size, accent).forEach((n) => nodes.push(n));
        }
      }
    }

    // Footer: accent dot + handle, counter, progress dots.
    const fy = c.h - c.pad + 14;
    const handle = c.deck.handle?.trim();
    if (handle) {
      nodes.push(
        { kind: "ellipse", cx: box.x + 8, cy: fy + 12, rx: 8, ry: 8, fill: accent },
        fixedBlock(c, handle, { x: box.x + 26, y: fy, w: box.w * 0.5, size: 24, font: c.fonts.sans, weight: 600, color: withAlpha(ink, 0.7), marks: {} }).node,
      );
    }
    nodes.push(
      fixedBlock(c, `${idx} / ${String(c.total).padStart(2, "0")}`, {
        x: box.x + box.w - 160, y: fy, w: 160, size: 22, font: c.fonts.sans, weight: 700, color: withAlpha(ink, 0.55), align: "right", marks: {},
      }).node,
    );
    nodes.push(...D.progressDots(c, box.x + box.w / 2 - (c.total - 1) * 5, fy + 12, 12, 4));

    nodes.push(D.grain(c, 0.02, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};
