import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, stack, textWidth } from "../render/ctx";
import type { Node, Paint } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyBox,
  bodyPart,
  bulletsPart,
  composeStack,
  defaultShell,
  featurePart,
  headStack,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
  D,
  type Part,
  type ShellStyle,
} from "./_shared";
import * as Do from "./_doodles";
import type { Preset } from "./types";

/**
 * The "illustrated" set — six playful, art-directed slide systems that lean on
 * a shared hand-drawn element library (`_doodles.ts`) plus the decor toolkit.
 * Each is a distinct visual world (notebook, editorial spot-illustration,
 * sticker pop, sketched infographic, comic storyboard, scrapbook collage), yet
 * every one composes its content through the shared parts (`composeStack` /
 * `featurePart`), so any deck — stat, quote, comparison, steps, list, chat —
 * renders correctly, survives missing fields, absurd copy lengths, any offered
 * palette and any slide count. Decoration is content-aware (see `motifsFor`)
 * and lives in the margins or behind text, never on top of it. No image model
 * is ever used: illustrations are procedural vectors.
 */

/** Place parts and keep each live part's y, so decoration can hang off it. */
function placed(
  parts: (Part | null)[],
  box: Box,
  gap: number,
  justify: ShellStyle["justify"],
): { part: Part; y: number }[] {
  const live = parts.filter((p): p is Part => !!p);
  if (live.length === 0) return [];
  const ys = stack(box.y, box.h, live.map((p) => p.h), gap, justify);
  return live.map((p, i) => ({ part: p, y: ys[i] }));
}

/** Full-bleed flat ground, so a template can paint "paper" over the palette bg. */
function ground(c: Ctx, fill: Paint): Node {
  return { kind: "rect", x: 0, y: 0, w: c.w, h: c.h, fill };
}

/** A soft procedural "photo"/illustration wash inside a box (no image model). */
function washFill(c: Ctx, b: Box): Node[] {
  const base: Paint = {
    type: "linear",
    x0: b.x,
    y0: b.y,
    x1: b.x + b.w,
    y1: b.y + b.h,
    stops: [
      { offset: 0, color: c.pal.accent },
      { offset: 1, color: c.pal.accent2 },
    ],
  };
  const out: Node[] = [{ kind: "rect", x: b.x, y: b.y, w: b.w, h: b.h, r: 8, fill: base }];
  const cols = [mix(c.pal.accent, "#ffffff", 0.4), c.pal.accent2, mix(c.pal.accent2, "#ffffff", 0.35)];
  for (let i = 0; i < 3; i++) {
    const bx = b.x + c.rand() * b.w;
    const by = b.y + c.rand() * b.h;
    const br = b.w * (0.3 + c.rand() * 0.34);
    const col = cols[i % cols.length];
    out.push({
      kind: "ellipse",
      cx: bx,
      cy: by,
      rx: br,
      ry: br * (0.7 + c.rand() * 0.5),
      fill: {
        type: "radial",
        cx: bx,
        cy: by,
        r: br,
        stops: [
          { offset: 0, color: withAlpha(col, 0.7) },
          { offset: 1, color: withAlpha(col, 0) },
        ],
      },
    });
  }
  return out;
}

/* ============================ 01 · NOTEBOOK =========================== */

export const notebook: Preset = {
  id: "notebook",
  name: "Doodle Notebook",
  category: "playful",
  blurb: "Spiral notebook page — ruled paper, red margin, sticky note, hand kicker and margin doodles.",
  defaultPalette: "notebook",
  palettes: ["notebook", "paper", "parchment", "cream"],
  needs: ["kicker", "body", "bullets", "note", "stat"],
  brief:
    "Lecture-notes on ruled paper. A hand-scrawled `kicker` label, a short title (3-8 words) with one word worth ringing, an optional line, and two to four brisk `bullets` the reader could have jotted down. Keep it plain, warm and specific; a `note` reads as a sticky reminder and a `stat` as a boxed figure in the margin.",
  slideRange: [5, 9],
  pad: 92,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    const red = "#e5484d";
    const paper = c.pal.surface;

    nodes.push(ground(c, paper));

    // Ruled horizontal lines across the page.
    const ruleCol = withAlpha(c.pal.fg, c.pal.dark ? 0.14 : 0.09);
    const top = 150;
    for (let y = top; y < c.h - 60; y += 66) {
      nodes.push({ kind: "line", x1: 70, y1: y, x2: c.w - 70, y2: y, stroke: ruleCol, lineWidth: 1.6 });
    }
    // Red margin rule down the left.
    const marginX = c.pad + 24;
    nodes.push({ kind: "line", x1: marginX, y1: 60, x2: marginX, y2: c.h - 60, stroke: withAlpha(red, 0.6), lineWidth: 2.4 });

    // Spiral binding across the top.
    for (let x = 90; x < c.w - 60; x += 74) {
      nodes.push(
        { kind: "line", x1: x, y1: 24, x2: x - 6, y2: 74, stroke: withAlpha(c.pal.fg, 0.35), lineWidth: 6, cap: "round" },
        { kind: "ellipse", cx: x, cy: 24, rx: 12, ry: 7, stroke: withAlpha(c.pal.fg, 0.3), lineWidth: 3 },
      );
    }

    // Corner page tab with the index.
    const tabW = 96;
    nodes.push(
      { kind: "rect", x: c.w - tabW, y: 118, w: tabW, h: 54, r: [12, 0, 0, 12], fill: withAlpha(accent, 0.18) },
      fixedBlock(c, `${String(c.index + 1).padStart(2, "0")}/${String(c.total).padStart(2, "0")}`, {
        x: c.w - tabW,
        y: 132,
        w: tabW - 14,
        size: 20,
        font: c.fonts.mono,
        weight: 700,
        color: accent,
        align: "center",
        marks: {},
      }).node,
    );

    const box: Box = { x: marginX + 30, y: top + 6, w: c.w - (marginX + 30) - c.pad, h: c.h - top - 6 - 96 };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 26,
      kickerFont: "hand",
      kickerUpper: false,
      kickerWeight: 700,
      kickerSize: 34,
      kickerLS: 0,
      kickerColor: accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 82,
      titleMin: 36,
      titleLH: 1.1,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 28,
      bodyLH: 1.44,
      bodyColor: c.pal.muted,
      bullet: "check",
      bulletColor: accent,
      bulletGap: 22,
    });

    const kick = kickerPart(c, s, box);
    const title = titlePart(c, s, box);
    const bodyP = bodyPart(c, s, box);
    const feat = featurePart(c, s, box);
    const noteP = c.slide.stat ? null : notePart(c, s, box); // stat handled as sticky, note too
    const pl = placed([kick, title, bodyP, feat, noteP], box, s.gap, "start");
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // Hand underline beneath the kicker.
    const kEntry = kick ? pl.find((e) => e.part === kick) : undefined;
    if (kick && kEntry && c.slide.kicker) {
      const kw = textWidth(c, c.slide.kicker, c.fonts.hand, s.kickerSize, s.kickerWeight, 0);
      nodes.push(...D.sketchUnderline(c, box.x, kEntry.y + kick.h + 2, Math.min(box.w * 0.6, Math.max(70, kw)), accent, 5));
    }

    // Sticky note in the lower-right carrying the note (or the stat headline).
    const stickyText = (c.slide.note && c.slide.note.trim()) || (c.slide.role === "cta" ? "save this ✔" : "");
    if (stickyText) {
      const sw = 300;
      const sh = 200;
      const sx = c.w - c.pad - sw + 10;
      const sy = c.h - 96 - sh;
      const rot = -0.05;
      nodes.push(Do.stickyNote(c, sx, sy, sw, sh, mix(accent, "#ffffff", c.pal.dark ? 0.2 : 0.55), { rotate: rot }));
      nodes.push({
        ...block(c, stickyText, {
          x: sx + 24,
          y: sy + 28,
          w: sw - 48,
          maxH: sh - 56,
          font: c.fonts.hand,
          weight: 700,
          max: 40,
          min: 20,
          lineHeight: 1.2,
          align: "left",
          color: c.pal.dark ? "#101010" : c.pal.fg,
          marks: {},
        }).node,
        rotate: rot,
        origin: [sx + sw / 2, sy + sh / 2],
      });
    }

    // A margin doodle: curved arrow nudging the body/bullets from the red rule.
    const anchor = pl.find((e) => e.part === (bodyP ?? feat));
    if (anchor) {
      nodes.push(...D.curvedArrow([marginX - 6, anchor.y - 8], [box.x - 6, anchor.y + 14], 26, withAlpha(accent, 0.85), 4));
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.03, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ======================= 02 · EDITORIAL ILLUSTRATION ================= */

export const editorial: Preset = {
  id: "editorial",
  name: "Editorial Illo",
  category: "editorial",
  blurb: "Magazine layout with a custom spot illustration — serif headline, thin rule, one visual metaphor.",
  defaultPalette: "cream",
  palettes: ["cream", "paper", "clay", "lavender"],
  needs: ["kicker", "body", "quote", "stat", "note"],
  brief:
    "An art-directed editorial page. A concise eyebrow `kicker`, a strong serif headline (4-10 words), and one supporting paragraph or `quote`. The lower third carries a simple abstract illustration standing in for the idea, so keep the copy the star and the tone considered, not busy.",
  slideRange: [5, 9],
  pad: 100,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    nodes.push(ground(c, c.pal.bg));

    const cb = contentBox(c);
    // Reserve the lower ~34% for the spot illustration.
    const illoH = Math.max(300, cb.h * 0.34);
    const textBox: Box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - illoH - 40 - 60 };

    // Eyebrow rule.
    nodes.push({ kind: "line", x1: cb.x, y1: cb.y + 6, x2: cb.x + 84, y2: cb.y + 6, stroke: accent, lineWidth: 4 });

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 26,
      kickerFont: "sans",
      kickerWeight: 700,
      kickerSize: 22,
      kickerLS: 4,
      kickerColor: accent,
      titleFont: "serif",
      titleWeight: 700,
      titleMax: 96,
      titleMin: 40,
      titleLH: 1.06,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "serif",
      bodyWeight: 400,
      bodySize: 30,
      bodyLH: 1.46,
      bodyColor: c.pal.muted,
      bullet: "dash",
      bulletColor: accent,
    });
    const inner: Box = { x: textBox.x, y: textBox.y + 24, w: textBox.w, h: textBox.h - 24 };
    nodes.push(...layoutParts([kickerPart(c, s, inner), titlePart(c, s, inner), bodyPart(c, s, inner) ?? featurePart(c, s, inner)], inner, s.gap, "start"));

    // Spot illustration band: an abstract visual metaphor from primitives.
    const ib: Box = { x: cb.x, y: cb.y + cb.h - illoH - 40, w: cb.w, h: illoH };
    const cx = ib.x + ib.w * 0.5;
    const cy = ib.y + ib.h * 0.52;
    const R = Math.min(ib.w, ib.h) * 0.4;
    // Soft organic blob behind.
    nodes.push(Do.blob(cx - R * 0.2, cy, R * 1.15, c.rand, withAlpha(accent, c.pal.dark ? 0.28 : 0.16)));
    // Orbit line + planet + moon.
    nodes.push(
      { kind: "ellipse", cx, cy, rx: R, ry: R * 0.42, stroke: withAlpha(c.pal.fg, 0.4), lineWidth: 3, rotate: -0.24, origin: [cx, cy] },
      { kind: "ellipse", cx, cy, rx: R * 0.5, ry: R * 0.5, fill: accent },
      { kind: "ellipse", cx: cx + R * 0.92, cy: cy - R * 0.2, rx: R * 0.14, ry: R * 0.14, fill: c.pal.accent2 },
    );
    // A single sparkle and a thin triangle accent.
    nodes.push(Do.sparkle(cx - R * 0.75, cy - R * 0.55, 20, c.pal.accent2));
    nodes.push({
      kind: "path",
      d: `M ${cx + R * 0.55} ${cy + R * 0.32} l 46 -78 l 46 78 Z`,
      stroke: withAlpha(c.pal.fg, 0.55),
      lineWidth: 3,
      join: "round",
    });

    // Optional caption for the illustration from the note.
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: ib.y + ib.h - 12,
          w: cb.w,
          size: 20,
          font: c.fonts.sans,
          weight: 500,
          color: withAlpha(c.pal.muted, 0.9),
          align: "center",
          marks: {},
        }).node,
      );
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.025, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ============================ 03 · STICKER POP ======================= */

export const stickerpop: Preset = {
  id: "stickerpop",
  name: "Sticker Pop",
  category: "playful",
  blurb: "Loud social stickers — outlined chip labels, a starburst badge, speech bubbles and scattered stars.",
  defaultPalette: "candy",
  palettes: ["candy", "highlighter", "sunset", "lavender"],
  needs: ["kicker", "body", "bullets", "stat", "note"],
  brief:
    "High-energy and shareable. A punchy `kicker` sticker, a bold short title (2-7 words) with one word worth highlighting, and either a quick `stat` for the badge or two to four `bullets`. Keep copy loud, upbeat and concrete.",
  slideRange: [4, 9],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    const accent2 = c.pal.accent2;
    const ink = c.pal.fg;
    const sticker = c.pal.dark ? "#ffffff" : c.pal.surface;
    const stickInk = c.pal.dark ? "#101010" : ink;

    nodes.push(ground(c, c.pal.bg));

    const box = bodyBox(c, 120);

    // Big pop badge top-right with the slide number, on a starburst.
    const badgeR = 58;
    const bcx = c.w - c.pad - badgeR + 6;
    const bcy = c.pad + badgeR - 6;
    nodes.push(...Do.burst(bcx, bcy, badgeR + 26, withAlpha(accent2, 0.8), 12, 5));
    nodes.push({ kind: "ellipse", cx: bcx, cy: bcy, rx: badgeR, ry: badgeR, fill: accent, stroke: sticker, lineWidth: 6 });
    nodes.push(
      fixedBlock(c, String(c.index + 1), {
        x: bcx - badgeR,
        y: bcy - badgeR * 0.6,
        w: badgeR * 2,
        size: badgeR * 0.9,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.dark ? "#101010" : "#ffffff",
        align: "center",
        marks: {},
      }).node,
    );

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      gap: 30,
      kickerFont: "sans",
      kickerWeight: 800,
      kickerSize: 24,
      kickerLS: 2,
      kickerColor: stickInk,
      kickerChip: { fill: sticker, color: stickInk, radius: 12 },
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 110,
      titleMin: 42,
      titleLH: 1.02,
      titleLS: -1.5,
      titleColor: ink,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: withAlpha(ink, 0.82),
      bullet: "check",
      bulletColor: accent2,
      bulletGap: 22,
    });

    // Custom title so we can drop a marker highlight behind its first line.
    const titleBlk = block(c, c.slide.title || c.deck.topic || " ", {
      x: box.x,
      y: 0,
      w: box.w,
      maxH: box.h * 0.42,
      font: c.fonts.sans,
      weight: 800,
      max: 110,
      min: 42,
      lineHeight: 1.02,
      align: "left",
      color: ink,
      letterSpacing: -1.5,
      marks: {},
    });
    const titleCustom: Part = { h: titleBlk.height, draw: (y) => [{ ...titleBlk.node, y }] };

    const kick = kickerPart(c, s, box);
    const bodyP = bodyPart(c, s, box);
    const feat = featurePart(c, s, box);
    const pl = placed([kick, titleCustom, bodyP, feat], box, s.gap, "center");

    // Highlight swash behind the title's first line (drawn before the text).
    const tEntry = pl.find((e) => e.part === titleCustom);
    if (tEntry && titleBlk.node.lines[0]) {
      const lw = Math.min(box.w, titleBlk.node.lines[0].width + 24);
      const size = titleBlk.size;
      nodes.push(Do.highlightStroke(box.x - 8, tEntry.y + size * 0.12, lw, size * 0.98, accent2, { rotate: -0.02 }));
    }
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // Scatter stickers into the margins.
    nodes.push(...Do.scatterAccents(c, box, [accent2, accent, mix(accent, ink, 0.2)], { count: 5, min: 14, max: 26 }));

    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ========================= 04 · INFOGRAPHIC SKETCH =================== */

export const infographic: Preset = {
  id: "infographic",
  name: "Infographic Sketch",
  category: "data",
  blurb: "Hand-drawn explainer — numbered sections, connectors, a mini chart and annotated figures.",
  defaultPalette: "paper",
  palettes: ["paper", "cream", "mono", "clay"],
  needs: ["kicker", "body", "steps", "stat", "items", "compare"],
  brief:
    "A visual explainer. A compact `kicker` + title, then the substance as structured data: `steps` for a process, a `stat` for a headline figure, `items` for a labelled list, or a `compare` for two sides. Keep labels short so the diagram stays clean.",
  slideRange: [5, 9],
  pad: 92,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    nodes.push(ground(c, c.pal.bg));

    // Faint hand-ruled grid.
    nodes.push(...D.gridLines(c, 72, withAlpha(c.pal.fg, c.pal.dark ? 0.06 : 0.05), 1));

    const cb = bodyBox(c, 96);
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 18,
      kickerFont: "mono",
      kickerWeight: 700,
      kickerSize: 22,
      kickerLS: 3,
      kickerColor: accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 74,
      titleMin: 34,
      titleLH: 1.08,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 26,
      bodyLH: 1.42,
      bodyColor: c.pal.muted,
      bullet: "number",
      bulletColor: accent,
      bulletGap: 24,
    });

    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24, gap: 14 });
    nodes.push(...head.nodes);

    // The diagram region below the header.
    const region: Box = { x: cb.x, y: head.bottom + 24, w: cb.w, h: cb.y + cb.h - (head.bottom + 24) };

    const st = c.slide.stat;
    if (st && !c.slide.steps && !c.slide.compare && !c.slide.items) {
      // Headline figure with a burst and a mini sparkline underneath.
      const big = block(c, st.value, {
        x: region.x,
        y: region.y,
        w: region.w * 0.62,
        maxH: region.h * 0.5,
        font: c.fonts.sans,
        weight: 800,
        max: 220,
        min: 90,
        lineHeight: 0.96,
        align: "left",
        color: accent,
        letterSpacing: -4,
        maxLines: 1,
        marks: {},
      });
      nodes.push(...Do.burst(region.x + region.w * 0.72, region.y + region.h * 0.22, 70, withAlpha(accent, 0.5), 12, 4));
      nodes.push(Do.star5(region.x + region.w * 0.72, region.y + region.h * 0.22, 30, c.pal.accent2));
      nodes.push({ ...big.node });
      nodes.push(
        fixedBlock(c, st.label, {
          x: region.x,
          y: region.y + big.height + 16,
          w: region.w * 0.8,
          size: 28,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          lineHeight: 1.3,
          marks: {},
        }).node,
      );
      const spark = region.y + region.h * 0.66;
      const vals = [3, 5, 4, 7, 6, 9, 8, 12];
      nodes.push(
        ...D.sparkline(c, { x: region.x, y: spark, w: region.w, h: region.h * 0.28 }, vals, { fill: true, color: accent }),
      );
    } else {
      // Structured content (steps / compare / items / bullets) via the shared
      // parts. The header already drew the body, so we never repeat it here.
      const feat = featurePart(c, s, region);
      if (feat) {
        nodes.push(...feat.draw(region.y));
        // A hand connector arrow pointing into the first row.
        nodes.push(...D.curvedArrow([region.x - 6, region.y - 10], [region.x + 34, region.y + 18], 24, withAlpha(accent, 0.7), 3.5));
      } else {
        // No structured field (a hook or CTA): anchor the space with a light
        // trend line and a couple of accents so the "data" identity still reads.
        const np = notePart(c, s, region);
        if (np) nodes.push(...np.draw(region.y));
        const chartY = region.y + region.h * (np ? 0.42 : 0.32);
        nodes.push(
          ...D.sparkline(
            c,
            { x: region.x, y: chartY, w: region.w, h: region.h * 0.34 },
            [3, 4, 3, 6, 5, 8, 7, 11],
            { fill: true, color: withAlpha(accent, 0.75) },
          ),
        );
        nodes.push(Do.star5(region.x + region.w - 40, chartY - 12, 22, c.pal.accent2));
      }
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.02, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ========================= 05 · COMIC / STORYBOARD ================== */

export const storyboard: Preset = {
  id: "storyboard",
  name: "Storyboard",
  category: "playful",
  blurb: "Comic panel — heavy border, halftone dots, a caption box, speech-bubble copy and an SFX word.",
  defaultPalette: "paper",
  palettes: ["paper", "candy", "sunset", "amber"],
  needs: ["kicker", "body", "chat", "quote", "note"],
  brief:
    "One comic panel per slide, told in sequence. The `kicker` is the caption box (a short scene label), the title is the beat (4-9 words), and `body` or a `quote` reads as dialogue. Keep it punchy and visual; a `chat` becomes the speech bubbles.",
  slideRange: [5, 9],
  pad: 84,
  render(c) {
    const nodes: Node[] = [];
    const ink = c.pal.fg;
    const accent = c.pal.accent;
    nodes.push(ground(c, c.pal.bg));

    // The panel.
    const px = c.pad - 24;
    const py = c.pad - 24;
    const pw = c.w - px * 2;
    const ph = c.h - py * 2;
    nodes.push({ kind: "rect", x: px, y: py, w: pw, h: ph, r: 6, fill: c.pal.surface, stroke: ink, lineWidth: 8 });

    // Halftone dots in the top-right corner, clipped to the panel.
    const dots: Node[] = [];
    for (let yy = py + 20; yy < py + ph * 0.4; yy += 22) {
      for (let xx = px + pw * 0.55; xx < px + pw - 16; xx += 22) {
        const d = (xx - (px + pw)) / (pw * 0.45);
        const r = Math.max(1.2, 5.5 * (1 + d));
        dots.push({ kind: "ellipse", cx: xx, cy: yy, rx: r, ry: r, fill: withAlpha(accent, 0.5) });
      }
    }
    nodes.push({ kind: "group", clip: { x: px, y: py, w: pw, h: ph, r: 6 }, children: dots });

    const inX = px + 44;
    const inW = pw - 88;

    // Caption box (kicker) top-left.
    const cap = (c.slide.kicker && c.slide.kicker.trim()) || (c.slide.role === "cover" ? "SCENE 01" : `PANEL ${String(c.index + 1).padStart(2, "0")}`);
    const capB = fixedBlock(c, cap.toUpperCase(), {
      x: inX + 18,
      y: py + 34,
      w: inW - 36,
      size: 22,
      font: c.fonts.mono,
      weight: 700,
      color: c.pal.dark ? "#101010" : ink,
      letterSpacing: 2,
      lineHeight: 1.1,
      marks: {},
    });
    const capW = Math.min(inW, textWidth(c, cap.toUpperCase(), c.fonts.mono, 22, 700, 2) + 40);
    nodes.push(
      { kind: "rect", x: inX, y: py + 22, w: capW, h: 50, fill: c.pal.accent2, stroke: ink, lineWidth: 3 },
      { ...capB.node },
    );

    // Title as a bold beat, with one word blown up as an SFX burst-word.
    const box: Box = { x: inX, y: py + 108, w: inW, h: ph - 108 - 96 };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 26,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 96,
      titleMin: 40,
      titleLH: 1.02,
      titleLS: -1,
      titleUpper: true,
      titleColor: ink,
      bodyFont: "sans",
      bodyWeight: 500,
      bodySize: 28,
      bodyLH: 1.4,
      bodyColor: withAlpha(ink, 0.82),
    });
    const title = titlePart(c, s, box, undefined, box.h * 0.4);

    // Dialogue: body/quote inside a speech bubble.
    const dialogue =
      (c.slide.body && c.slide.body.trim()) ||
      (c.slide.quote && `“${c.slide.quote.text}”`) ||
      (c.slide.note && c.slide.note.trim()) ||
      "";
    const parts: (Part | null)[] = [title];
    if (dialogue && !c.slide.chat) {
      const bubbleInnerW = box.w - 56;
      const db = fixedBlock(c, dialogue, {
        x: box.x + 28,
        y: 0,
        w: bubbleInnerW - 8,
        size: 27,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.dark ? "#101010" : ink,
        lineHeight: 1.34,
        marks: s.marks,
      });
      const bubbleH = db.height + 52;
      parts.push({
        h: bubbleH + 22,
        draw(y) {
          const out: Node[] = [];
          out.push(...Do.speechBubble(box.x, y, box.w, bubbleH, { fill: c.pal.bg, stroke: ink, lineWidth: 3, tail: "bl" }));
          out.push({ ...db.node, y: y + 26 });
          return out;
        },
      });
    } else {
      // chat / other structured content.
      const feat = featurePart(c, s, box);
      if (feat) parts.push(feat);
    }

    const pl = placed(parts, box, s.gap, "start");
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // SFX word bottom-right.
    if (c.slide.role !== "cover") {
      const sfxOptions = ["POW!", "WHAM!", "ZAP!", "BOOM!", "AHA!", "TA-DA!"];
      const sfx = sfxOptions[Math.floor(c.rand() * sfxOptions.length) % sfxOptions.length];
      const sx = px + pw - 150;
      const sy = py + ph - 150;
      nodes.push(...Do.burst(sx, sy, 78, withAlpha(accent, 0.8), 12, 6));
      nodes.push(Do.star5(sx, sy, 66, accent, { fill: true }));
      const tw = textWidth(c, sfx, c.fonts.sans, 30, 800, 0);
      nodes.push({
        ...fixedBlock(c, sfx, {
          x: sx - tw / 2,
          y: sy - 18,
          w: tw + 8,
          size: 30,
          font: c.fonts.sans,
          weight: 800,
          color: c.pal.dark ? "#101010" : "#ffffff",
          align: "left",
          marks: {},
        }).node,
        rotate: -0.12,
        origin: [sx, sy],
      });
    }

    nodes.push(...D.footer(c, { color: withAlpha(ink, 0.6) }));
    nodes.push(D.grain(c, 0.02, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ========================= 06 · CREATIVE SCRAPBOOK ================== */

export const scrapbook: Preset = {
  id: "scrapbook",
  name: "Scrapbook",
  category: "playful",
  blurb: "Collage page — a taped photo wash, handwritten notes on torn paper, a rubber stamp and tape.",
  defaultPalette: "parchment",
  palettes: ["parchment", "cream", "paper", "clay"],
  needs: ["kicker", "body", "bullets", "note", "quote"],
  brief:
    "A curated collage. A short handwritten `kicker` on tape, a title (3-8 words), a warm supporting line as `body`, and optional `bullets` as pinned notes. A framed colour 'photo' anchors the page, so keep the copy personal and specific.",
  slideRange: [5, 8],
  pad: 90,
  render(c) {
    const nodes: Node[] = [];
    const accent = c.pal.accent;
    const paper = c.pal.surface;
    nodes.push(ground(c, c.pal.bg));
    nodes.push(...D.dotGrid(c, 58, 2, withAlpha(c.pal.fg, 0.06)));

    const cb = contentBox(c);

    // A taped "photo" card, rotated, in the upper-right.
    const phW = Math.min(360, cb.w * 0.46);
    const phH = phW * 1.12;
    const phX = cb.x + cb.w - phW + 8;
    const phY = cb.y - 6;
    const rot = 0.05;
    nodes.push({
      kind: "group",
      rotate: rot,
      origin: [phX + phW / 2, phY + phH / 2],
      children: [
        { kind: "rect", x: phX - 16, y: phY - 16, w: phW + 32, h: phH + 42, r: 6, fill: "#ffffff", shadow: { color: withAlpha("#000000", 0.22), blur: 30, x: 0, y: 14 } },
        ...washFill(c, { x: phX, y: phY, w: phW, h: phH - 6 }),
      ],
    });
    // Tape across the top of the photo.
    nodes.push(D.tape(c, phX + phW / 2 - 60, phY - 34, 120, rot - 0.06));

    // Rubber stamp bottom-right.
    nodes.push(...Do.stamp(c, cb.x + cb.w - 90, cb.y + cb.h - 80, 66, c.slide.role === "cta" ? "GO" : `PG ${c.index + 1}`, withAlpha(accent, 0.8)));

    // Text column on the left, clear of the photo.
    const box: Box = { x: cb.x, y: cb.y + 8, w: cb.w * 0.54, h: cb.h - 80 };

    // Kicker on a strip of tape.
    if (c.slide.kicker && c.slide.kicker.trim()) {
      const kt = c.slide.kicker.trim();
      const ktw = Math.min(box.w, textWidth(c, kt, c.fonts.hand, 30, 700, 0) + 48);
      nodes.push(D.tape(c, box.x, box.y, ktw, -0.03, withAlpha(c.pal.dark ? "#ffffff" : "#e7d9a6", 0.6)));
      nodes.push({
        ...fixedBlock(c, kt, { x: box.x + 20, y: box.y + 6, w: ktw - 30, size: 28, font: c.fonts.hand, weight: 700, color: c.pal.dark ? "#101010" : c.pal.fg, lineHeight: 1, marks: {} }).node,
        rotate: -0.03,
        origin: [box.x + ktw / 2, box.y + 20],
      });
    }

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      gap: 22,
      titleFont: "serif",
      titleWeight: 700,
      titleMax: 76,
      titleMin: 34,
      titleLH: 1.08,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "hand",
      bodyWeight: 700,
      bodySize: 30,
      bodyLH: 1.34,
      bodyColor: c.pal.fg,
      bullet: "check",
      bulletColor: accent,
      bulletGap: 18,
    });
    const inner: Box = { x: box.x, y: box.y + 64, w: box.w, h: box.h - 64 };
    const parts = [titlePart(c, s, inner), bodyPart(c, s, inner), bulletsPart(c, s, inner) ?? featurePart(c, s, inner)];
    const pl = placed(parts, inner, s.gap, "start");
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // A torn-paper note pinned lower-left carrying the note/quote.
    const memoText = (c.slide.note && c.slide.note.trim()) || (c.slide.quote && `“${c.slide.quote.text}”`) || "";
    if (memoText) {
      const nw = cb.w * 0.42;
      const nx = cb.x + cb.w - nw;
      const ny = cb.y + cb.h - 210;
      const nrot = -0.04;
      nodes.push({
        kind: "rect",
        x: nx,
        y: ny,
        w: nw,
        h: 150,
        r: 3,
        fill: mix(paper, accent, c.pal.dark ? 0.12 : 0.06),
        rotate: nrot,
        origin: [nx + nw / 2, ny + 75],
        shadow: { color: withAlpha("#000000", 0.14), blur: 18, x: 0, y: 8 },
      });
      nodes.push({
        ...block(c, memoText, { x: nx + 22, y: ny + 22, w: nw - 44, maxH: 110, font: c.fonts.hand, weight: 700, max: 34, min: 18, lineHeight: 1.22, align: "left", color: c.pal.fg, marks: {} }).node,
        rotate: nrot,
        origin: [nx + nw / 2, ny + 75],
      });
      // A star sticker on the note corner.
      nodes.push(Do.star5(nx + 18, ny + 12, 20, accent));
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.035, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

export const ILLUSTRATED_PRESETS: Preset[] = [
  notebook,
  editorial,
  stickerpop,
  infographic,
  storyboard,
  scrapbook,
];
