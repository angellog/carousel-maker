import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, stack, textWidth } from "../render/ctx";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyBox,
  bodyPart,
  bulletsPart,
  composeStack,
  defaultShell,
  featurePart,
  kickerPart,
  notePart,
  scene,
  titlePart,
  D,
  type Part,
  type ShellStyle,
} from "./_shared";
import type { Preset } from "./types";

/**
 * Four vivid, playful "design systems". Every pixel is vectors, type and
 * procedural texture — no image model is ever consulted. Each preset is robust
 * to missing fields, extreme copy, a two-slide deck and every palette it
 * offers; they lean on the shared parts and decor library rather than
 * hand-rolling geometry.
 */

/**
 * Place a list of parts inside a box and return each live part with its y, so a
 * preset can both draw the part and hang decoration off its measured position
 * (an underline, a hand-drawn circle). Mirrors `layoutParts` but keeps the ys.
 */
function placed(
  parts: (Part | null)[],
  box: Box,
  gap: number,
  justify: ShellStyle["justify"],
): { part: Part; y: number }[] {
  const live = parts.filter((p): p is Part => !!p);
  const ys = stack(box.y, box.h, live.map((p) => p.h), gap, justify);
  return live.map((p, i) => ({ part: p, y: ys[i] }));
}

/** Relative luminance of a hex colour, for picking a legible ink. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(f.padEnd(6, "0"), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/* ------------------------------- Aurora ------------------------------- */

export const aurora: Preset = {
  id: "aurora",
  name: "Aurora",
  category: "playful",
  blurb: "Soft gradient-mesh dreamscape — blurred colour fields under clean floating sans type.",
  defaultPalette: "sunset",
  palettes: ["sunset", "electric", "midnight", "lavender"],
  needs: ["kicker", "body", "note"],
  brief:
    "Dreamy and spacious. One calm idea per slide: a short title of 3-8 words and a single supporting line. Let the gradient carry the mood — keep the copy minimal, bright and airy, and lean on one accent word.",
  slideRange: [6, 9],
  pad: 100,
  render(c) {
    const nodes: Node[] = [];
    const box = bodyBox(c, 96);
    const isCover = c.slide.role === "cover";

    // Vector "mesh" background: blurred radial colour fields from the palette.
    const accents = [c.pal.accent, c.pal.accent2, mix(c.pal.accent, c.pal.accent2, 0.5)];
    nodes.push(...D.meshBlobs(c, accents, 5));

    // Minimal chrome: a single accent dot pinned near the top.
    nodes.push({ kind: "ellipse", cx: c.w / 2, cy: Math.max(28, c.pad * 0.66), rx: 7, ry: 7, fill: c.pal.accent });

    const s = defaultShell(c, {
      align: "center",
      justify: "center",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: isCover ? 128 : 104,
      titleMin: 44,
      titleLH: 1.03,
      titleLS: -2.5,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 32,
      bodyLH: 1.42,
      bodyColor: withAlpha(c.pal.fg, 0.82),
      kickerFont: "sans",
      kickerWeight: 700,
      kickerSize: 22,
      kickerLS: 4,
      kickerColor: c.pal.accent,
      kickerChip: { fill: withAlpha(c.pal.accent, c.pal.dark ? 0.22 : 0.16), color: c.pal.accent, radius: 999 },
      gap: 34,
    });

    nodes.push(...composeStack(c, s, box));
    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.025));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------- Sticky ------------------------------- */

export const sticky: Preset = {
  id: "sticky",
  name: "Sticky",
  category: "playful",
  blurb: "A scrapbook sticky-note, taped down slightly crooked, one word underlined by hand.",
  defaultPalette: "candy",
  palettes: ["candy", "lavender", "amber", "notebook"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Casual and warm, like a note jotted on a fridge. Title 3-7 words, an optional line of body, and up to three quick hand-scrawled bullets. Keep it personal, specific and upbeat.",
  slideRange: [5, 8],
  pad: 84,
  render(c) {
    const nodes: Node[] = [];
    const cb = contentBox(c);

    // Warm ground.
    nodes.push(...D.dotGrid(c, 58, 2.4, withAlpha(c.pal.accent, 0.1)));

    // The note card, tilted a hair. Text stays upright — the paper is crooked,
    // the handwriting is not.
    const rot = 0.02;
    const cardX = cb.x - 4;
    const cardY = cb.y + 10;
    const cardW = cb.w + 8;
    const cardH = cb.h - 44;
    nodes.push(D.card(c, cardX, cardY, cardW, cardH, { fill: c.pal.surface, radius: 12, rotate: rot }));

    // Tape strips holding the top corners.
    nodes.push(D.tape(c, cardX + 44, cardY - 18, 150, -0.14));
    nodes.push(D.tape(c, cardX + cardW - 194, cardY - 14, 150, 0.11));

    const inner: Box = { x: cardX + 58, y: cardY + 62, w: cardW - 116, h: cardH - 130 };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      kickerFont: "hand",
      kickerUpper: false,
      kickerWeight: 700,
      kickerSize: 32,
      kickerLS: 0,
      kickerColor: c.pal.accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 78,
      titleMin: 36,
      titleLH: 1.06,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 27,
      bodyLH: 1.4,
      bodyColor: c.pal.muted,
      bullet: "dash",
      bulletColor: c.pal.accent,
      gap: 24,
    });

    // Build the title directly so we can underline its first line by hand.
    const titleBlk = block(c, c.slide.title || "", {
      x: inner.x,
      y: 0,
      w: inner.w,
      maxH: inner.h * 0.44,
      font: c.fonts.sans,
      weight: 800,
      max: 78,
      min: 36,
      lineHeight: 1.06,
      align: "left",
      color: c.pal.fg,
      letterSpacing: -1,
      marks: s.marks,
    });
    const titlePartCustom: Part = { h: titleBlk.height, draw: (y) => [{ ...titleBlk.node, y }] };

    const pl = placed(
      [kickerPart(c, s, inner), titlePartCustom, bodyPart(c, s, inner), bulletsPart(c, s, inner), notePart(c, s, inner)],
      inner,
      s.gap,
      "center",
    );
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // Hand underline under the title's first line.
    const tEntry = pl.find((e) => e.part === titlePartCustom);
    if (tEntry) {
      const firstW = titleBlk.node.lines[0]?.width ?? inner.w * 0.3;
      const ulW = Math.max(70, Math.min(firstW, inner.w * 0.55));
      nodes.push(...D.sketchUnderline(c, inner.x, tEntry.y + titleBlk.size * 1.0, ulW, c.pal.accent, 7));
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.03, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ Receipt ------------------------------- */

export const receipt: Preset = {
  id: "receipt",
  name: "Receipt",
  category: "playful",
  blurb: "A thermal receipt — narrow white ticket, perforated edges, monospace, a barcode at the end.",
  defaultPalette: "paper",
  palettes: ["paper", "mono", "parchment", "slate"],
  needs: ["kicker", "body", "items", "note"],
  brief:
    "Itemise the idea like a purchase. Use `items` as line-items — a short label on the left, a tight value on the right. Add a punchy title and one closing line. Tiny caps, terse copy, everything monospace.",
  slideRange: [5, 9],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    // The receipt is always a white ticket with dark ink, whatever the palette,
    // so the mono copy stays legible; the palette only tints the ground.
    const ink = "#1a1712";
    const sub = "#6f695f";
    const ground = mix(c.pal.bg, c.pal.accent, 0.06);

    const paperW = 660;
    const panelX = (c.w - paperW) / 2;
    const panelTop = 74;
    const panelBottom = c.h - 74;
    const panelH = panelBottom - panelTop;

    nodes.push({
      kind: "rect",
      x: panelX,
      y: panelTop,
      w: paperW,
      h: panelH,
      fill: "#ffffff",
      shadow: { color: "rgba(0,0,0,0.18)", blur: 36, x: 0, y: 14 },
    });
    // Perforated top & bottom edges: ground-coloured scallops carve the ticket.
    nodes.push(...D.perforation(c, panelTop, 12, ground));
    nodes.push(...D.perforation(c, panelBottom, 12, ground));

    const padX = 46;
    const innerX = panelX + padX;
    const innerW = paperW - padX * 2;
    const dashAt = (yy: number): Node => ({
      kind: "line",
      x1: innerX,
      y1: yy,
      x2: innerX + innerW,
      y2: yy,
      stroke: withAlpha("#000000", 0.35),
      lineWidth: 1.5,
      dash: [2, 7],
      cap: "round",
    });

    let y = panelTop + 52;

    // Store header — the kicker as tiny caps, centred.
    const head = (c.slide.kicker || "RECEIPT").trim() || "RECEIPT";
    const hb = fixedBlock(c, head, {
      x: innerX,
      y,
      w: innerW,
      size: 22,
      font: c.fonts.mono,
      weight: 700,
      color: ink,
      align: "center",
      letterSpacing: 3,
      uppercase: true,
      lineHeight: 1.2,
      marks: {},
    });
    nodes.push(hb.node);
    y += hb.height + 8;

    const subl = c.deck.handle?.trim() || "- thank you -";
    const sb = fixedBlock(c, subl, {
      x: innerX,
      y,
      w: innerW,
      size: 15,
      font: c.fonts.mono,
      weight: 500,
      color: sub,
      align: "center",
      letterSpacing: 1,
      lineHeight: 1.2,
      marks: {},
    });
    nodes.push(sb.node);
    y += sb.height + 18;

    nodes.push(dashAt(y));
    y += 24;

    // Title — the "order".
    const tb = block(c, c.slide.title || "", {
      x: innerX,
      y,
      w: innerW,
      maxH: 300,
      font: c.fonts.mono,
      weight: 700,
      max: 46,
      min: 22,
      lineHeight: 1.16,
      align: "center",
      color: ink,
      letterSpacing: -0.5,
      marks: {},
    });
    nodes.push(tb.node);
    y += tb.height + 16;

    if (c.slide.body) {
      const bb = fixedBlock(c, c.slide.body, {
        x: innerX,
        y,
        w: innerW,
        size: 19,
        font: c.fonts.mono,
        weight: 500,
        color: sub,
        align: "center",
        lineHeight: 1.42,
        marks: {},
      });
      nodes.push(bb.node);
      y += bb.height + 18;
    }

    nodes.push(dashAt(y));
    y += 22;

    // Line-items, right-aligned values with dotted leaders.
    const items = c.slide.items;
    if (items && items.length > 0) {
      const rowSize = Math.max(16, 22 - items.length * 0.6);
      for (const it of items.slice(0, 8)) {
        const vw = textWidth(c, it.value, c.fonts.mono, rowSize, 700);
        const labelW = Math.max(40, innerW - vw - 16);
        nodes.push(
          fixedBlock(c, it.label, {
            x: innerX,
            y,
            w: labelW,
            size: rowSize,
            font: c.fonts.mono,
            weight: 500,
            color: ink,
            lineHeight: 1.25,
            marks: {},
          }).node,
          fixedBlock(c, it.value, {
            x: innerX + innerW - vw,
            y,
            w: vw + 6,
            size: rowSize,
            font: c.fonts.mono,
            weight: 700,
            color: ink,
            align: "right",
            marks: {},
          }).node,
        );
        const lw = textWidth(c, it.label, c.fonts.mono, rowSize, 500);
        const dx = innerX + Math.min(lw + 12, Math.max(0, innerW - vw - 24));
        const dw = innerX + innerW - vw - 12 - dx;
        if (dw > 16) {
          nodes.push({
            kind: "line",
            x1: dx,
            y1: y + rowSize * 1.05,
            x2: dx + dw,
            y2: y + rowSize * 1.05,
            stroke: withAlpha("#000000", 0.3),
            lineWidth: 1.4,
            dash: [2, 6],
            cap: "round",
          });
        }
        y += rowSize * 1.9;
      }
      nodes.push(dashAt(y + 2));
    }

    // Footer block pinned to the bottom of the ticket: note, barcode, serial.
    const barY = panelBottom - 128;
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: innerX,
          y: barY - 40,
          w: innerW,
          size: 15,
          font: c.fonts.mono,
          weight: 500,
          color: sub,
          align: "center",
          lineHeight: 1.3,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.barcode(c, innerX + innerW * 0.12, barY, innerW * 0.76, 58, ink));
    const serial = `NO. ${String(c.index + 1).padStart(4, "0")} / ${String(c.total).padStart(4, "0")}`;
    nodes.push(
      fixedBlock(c, serial, {
        x: innerX,
        y: barY + 72,
        w: innerW,
        size: 15,
        font: c.fonts.mono,
        weight: 500,
        color: ink,
        align: "center",
        letterSpacing: 2,
        marks: {},
      }).node,
    );

    return scene(c, ground, nodes);
  },
};

/* ----------------------------- Chalkboard ----------------------------- */

export const chalkboard: Preset = {
  id: "chalkboard",
  name: "Chalkboard",
  category: "playful",
  blurb: "A chalkboard lesson — chalky white type on dark slate with a hand-circled kicker.",
  defaultPalette: "chalk",
  palettes: ["chalk", "forest", "midnight", "slate"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Teach one thing per slide, like a lesson written on a board. Title 3-8 words, a plain-spoken supporting line, and a few chalk-dash bullets. Warm, human and lightly hand-drawn.",
  slideRange: [6, 9],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    const cb = contentBox(c);
    const box = bodyBox(c, 96);
    const chalk = c.pal.fg;
    const accent = c.pal.accent;

    // Faint chalk frame around the board.
    nodes.push({
      kind: "rect",
      x: cb.x - 8,
      y: cb.y - 8,
      w: cb.w + 16,
      h: cb.h + 16,
      r: 10,
      stroke: withAlpha(chalk, 0.28),
      lineWidth: 3,
    });

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      kickerFont: "hand",
      kickerUpper: false,
      kickerWeight: 700,
      kickerSize: 34,
      kickerLS: 0,
      kickerColor: accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 96,
      titleMin: 40,
      titleLH: 1.05,
      titleLS: -1.5,
      titleColor: chalk,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 30,
      bodyLH: 1.42,
      bodyColor: withAlpha(chalk, 0.78),
      bullet: "dash",
      bulletColor: accent,
      gap: 30,
    });

    const kick = kickerPart(c, s, box);
    const pl = placed(
      [kick, titlePart(c, s, box), bodyPart(c, s, box), featurePart(c, s, box), notePart(c, s, box)],
      box,
      s.gap,
      "center",
    );
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // Hand-drawn circle around the "lesson" kicker.
    if (c.slide.kicker && kick && pl[0]?.part === kick) {
      const kw = textWidth(c, c.slide.kicker, c.fonts.hand, s.kickerSize, s.kickerWeight, s.kickerLS);
      const w = Math.min(box.w * 0.7, Math.max(90, kw));
      const cx = box.x + w / 2;
      const cy = pl[0].y + kick.h / 2;
      nodes.push(D.sketchCircle(c, cx, cy, w / 2 + 22, kick.h / 2 + 14, accent, 5));
    }

    nodes.push(...D.footer(c, { color: withAlpha(chalk, 0.72) }));
    nodes.push(D.grain(c, 0.06, c.pal.dark ? "#f3f0e7" : "#1c2a24"));
    return scene(c, c.pal.bg, nodes);
  },
};

export const VIVID_PRESETS: Preset[] = [aurora, sticky, receipt, chalkboard];
