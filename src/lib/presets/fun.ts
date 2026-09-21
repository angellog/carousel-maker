import type { Box, Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, stack, textWidth } from "../render/ctx";
import type { Node, Paint } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  bodyBox,
  bulletsPart,
  defaultShell,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
  D,
  type Part,
  type ShellStyle,
} from "./_shared";
import type { Preset } from "./types";

/**
 * The "playful" set — four canvas-rendered slide systems that lean into a
 * physical, hand-made feel: an index card, a neon arcade cabinet, an instant
 * photo and a sketchbook. Every pixel is vectors, type and procedural texture;
 * no image model is ever consulted. Each preset is robust to missing fields,
 * 60-word copy, a one-character line, a two-slide deck and every palette it
 * offers, and each leans on the shared parts + decor library rather than
 * hand-rolling geometry.
 */

/**
 * Place a list of parts inside a box and keep each live part's y, so a preset
 * can both draw the part and hang decoration off its measured position (a
 * sketch circle, a hand underline). Mirrors `layoutParts` but returns the ys.
 */
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

/* -------------------------------- Memo -------------------------------- */

export const memo: Preset = {
  id: "memo",
  name: "Memo",
  category: "playful",
  blurb: "A lined index card — red top rule, a punched hole, mono label, upright notes.",
  defaultPalette: "notebook",
  palettes: ["notebook", "paper", "parchment", "candy"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "One card, one idea. A short punchy title (3-8 words), an optional supporting line, and up to four brisk notes as bullets — as if jotted on a 3x5 index card. Keep the copy plain, upright and specific; the `kicker` reads as a tiny filing label.",
  slideRange: [5, 9],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    const cb = contentBox(c);

    // Desk ground behind the card.
    nodes.push(...D.dotGrid(c, 60, 2.2, withAlpha(c.pal.fg, 0.06)));

    // The card itself.
    const cardX = cb.x;
    const cardW = cb.w;
    const cardY = cb.y + 8;
    const cardH = cb.h - 8;
    nodes.push(D.card(c, cardX, cardY, cardW, cardH, { fill: c.pal.surface, radius: 16 }));

    // Index-card inks: a red top rule over faint ruled lines.
    const red = "#e5484d";
    const ruleCol = withAlpha(c.pal.accent, c.pal.dark ? 0.3 : 0.2);
    const headerH = 132;
    const redY = cardY + headerH;
    const step = 62;
    for (let ly = redY + step; ly < cardY + cardH - 34; ly += step) {
      nodes.push({
        kind: "line",
        x1: cardX + 40,
        y1: ly,
        x2: cardX + cardW - 40,
        y2: ly,
        stroke: ruleCol,
        lineWidth: 1.6,
      });
    }
    nodes.push({
      kind: "line",
      x1: cardX + 40,
      y1: redY,
      x2: cardX + cardW - 40,
      y2: redY,
      stroke: withAlpha(red, 0.85),
      lineWidth: 2.6,
    });

    // Punched hole, centred in the header band.
    const holeCx = cardX + cardW / 2;
    const holeCy = cardY + 50;
    nodes.push(
      { kind: "ellipse", cx: holeCx, cy: holeCy, rx: 18, ry: 18, fill: c.pal.bg },
      {
        kind: "ellipse",
        cx: holeCx,
        cy: holeCy,
        rx: 18,
        ry: 18,
        stroke: withAlpha(c.pal.fg, 0.18),
        lineWidth: 2,
      },
    );

    // Mono filing label from the kicker.
    const label =
      (c.slide.kicker && c.slide.kicker.trim()) ||
      (c.slide.role === "cover" ? "INDEX CARD" : `CARD ${String(c.index + 1).padStart(2, "0")}`);
    nodes.push(
      fixedBlock(c, label, {
        x: cardX + 44,
        y: cardY + 42,
        w: cardW - 88,
        size: 22,
        font: c.fonts.mono,
        weight: 700,
        color: red,
        letterSpacing: 3,
        uppercase: true,
        lineHeight: 1.2,
        marks: {},
      }).node,
    );

    // Upright copy, centred in the ruled body of the card.
    const inner: Box = {
      x: cardX + 44,
      y: redY + 24,
      w: cardW - 88,
      h: cardY + cardH - (redY + 24) - 84,
    };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      gap: 22,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 72,
      titleMin: 34,
      titleLH: 1.08,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 26,
      bodyLH: 1.46,
      bodyColor: c.pal.muted,
      bullet: "square",
      bulletColor: red,
      bulletGap: 18,
    });
    nodes.push(
      ...layoutParts(
        [titlePart(c, s, inner), bodyPart(c, s, inner), bulletsPart(c, s, inner)],
        inner,
        s.gap,
        "center",
      ),
    );

    // Note as pinned small print at the foot of the card (single line region).
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cardX + 44,
          y: cardY + cardH - 66,
          w: cardW - 88,
          size: 20,
          font: c.fonts.sans,
          weight: 500,
          color: withAlpha(c.pal.muted, 0.9),
          lineHeight: 1.3,
          marks: {},
        }).node,
      );
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.025, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------- Arcade ------------------------------- */

export const arcade: Preset = {
  id: "arcade",
  name: "Arcade",
  category: "playful",
  blurb: "Retro 8-bit cabinet — near-black scanlines, a pixel frame, blocky neon caps.",
  defaultPalette: "electric",
  palettes: ["electric", "highlighter", "midnight", "candy"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "High-energy and blocky, like a game screen. A short punchy title (2-6 words) in caps, an optional one-line readout, and up to four quick bullets as 'power-ups'. Keep it loud and terse; the `kicker` reads as a level tag.",
  slideRange: [4, 9],
  pad: 104,
  render(c) {
    const nodes: Node[] = [];
    const dark = c.pal.dark;
    // Force a near-black cabinet ground so the neon reads on every palette.
    const ground = dark ? c.pal.bg : "#0b0b12";
    const ink = dark ? c.pal.fg : "#ffffff";
    const neon = c.pal.accent;
    const neon2 = c.pal.accent2;

    // Scanlines across the whole screen.
    for (let y = 0; y < c.h; y += 8) {
      nodes.push({ kind: "line", x1: 0, y1: y, x2: c.w, y2: y, stroke: withAlpha("#000000", 0.22), lineWidth: 2 });
    }

    // Pixel-block frame.
    const fx = Math.max(28, c.pad - 36);
    const fy = fx;
    const fw = c.w - fx * 2;
    const fh = c.h - fy * 2;
    nodes.push({ kind: "rect", x: fx, y: fy, w: fw, h: fh, stroke: withAlpha(neon, 0.9), lineWidth: 6 });
    const blk = 20;
    for (const [px, py] of [
      [fx, fy],
      [fx + fw, fy],
      [fx, fy + fh],
      [fx + fw, fy + fh],
    ]) {
      nodes.push({ kind: "rect", x: px - blk / 2, y: py - blk / 2, w: blk, h: blk, fill: neon2 });
    }

    // Blocky numbered badge, top-right inside the frame (overlaid, so it
    // reserves no vertical space in the content column).
    const badge = 66;
    const bx = fx + fw - 26 - badge;
    const by = fy + 26;
    const num = String(c.index + 1).padStart(2, "0");
    nodes.push({ kind: "rect", x: bx, y: by, w: badge, h: badge, fill: neon });
    nodes.push(
      fixedBlock(c, num, {
        x: bx,
        y: by + badge * 0.22,
        w: badge,
        size: badge * 0.5,
        font: c.fonts.mono,
        weight: 700,
        color: ground,
        align: "center",
        marks: {},
      }).node,
    );

    // Content column filling the frame.
    const box: Box = {
      x: fx + 40,
      y: fy + 40,
      w: fw - 80,
      h: fh - 110,
    };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      gap: 30,
      kickerFont: "mono",
      kickerWeight: 700,
      kickerSize: 22,
      kickerLS: 4,
      kickerUpper: true,
      kickerColor: ground,
      kickerChip: { fill: neon2, color: ground, radius: 2 },
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 104,
      titleMin: 40,
      titleLH: 1.02,
      titleLS: 0,
      titleUpper: true,
      titleColor: ink,
      bodyFont: "mono",
      bodyWeight: 500,
      bodySize: 26,
      bodyLH: 1.5,
      bodyColor: withAlpha(ink, 0.8),
      bullet: "square",
      bulletColor: neon,
      bulletGap: 22,
    });
    nodes.push(
      ...layoutParts(
        [
          kickerPart(c, s, box),
          titlePart(c, s, box),
          bodyPart(c, s, box),
          bulletsPart(c, s, box),
          notePart(c, s, box),
        ],
        box,
        s.gap,
        "center",
      ),
    );

    nodes.push(...D.footer(c, { color: withAlpha(ink, 0.72) }));
    nodes.push(D.grain(c, 0.05, "#ffffff"));
    return scene(c, ground, nodes);
  },
};

/* ------------------------------ Polaroid ------------------------------ */

export const polaroid: Preset = {
  id: "polaroid",
  name: "Polaroid",
  category: "playful",
  blurb: "An instant photo — white frame, a soft gradient 'shot', a hand caption on the strip.",
  defaultPalette: "paper",
  palettes: ["paper", "candy", "lavender", "sunset"],
  needs: ["kicker", "body", "note"],
  brief:
    "One framed 'photo' per slide. The title is the headline printed over the picture (3-7 words); `body` is the handwritten caption on the strip beneath it — one warm, personal line. The `kicker` is a small tag in the corner. No real imagery: the shot is a soft colour wash.",
  slideRange: [5, 8],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    const cb = contentBox(c);

    // Warm ground.
    nodes.push(...D.dotGrid(c, 54, 2.2, withAlpha(c.pal.accent, 0.1)));

    // The polaroid frame, upright so text stays legible.
    const frameX = cb.x + 10;
    const frameY = cb.y;
    const frameW = cb.w - 20;
    const frameH = cb.h;
    nodes.push(D.card(c, frameX, frameY, frameW, frameH, { fill: "#ffffff", radius: 8 }));

    // The "photo": even bezel on three sides, thick caption strip below.
    const bezel = 34;
    const strip = 180;
    const px = frameX + bezel;
    const py = frameY + bezel;
    const pw = frameW - bezel * 2;
    const ph = frameH - bezel - strip;

    const base: Paint = {
      type: "linear",
      x0: px,
      y0: py,
      x1: px + pw,
      y1: py + ph,
      stops: [
        { offset: 0, color: c.pal.accent },
        { offset: 1, color: c.pal.accent2 },
      ],
    };
    const blobCols = [mix(c.pal.accent, "#ffffff", 0.4), c.pal.accent2, mix(c.pal.accent2, "#ffffff", 0.35)];
    const photo: Node[] = [{ kind: "rect", x: px, y: py, w: pw, h: ph, r: 4, fill: base }];
    for (let i = 0; i < 4; i++) {
      const bx = px + c.rand() * pw;
      const by = py + c.rand() * ph;
      const br = pw * (0.28 + c.rand() * 0.36);
      const col = blobCols[i % blobCols.length];
      photo.push({
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
    // Scrim under the lower half so the headline reads on any wash.
    photo.push({
      kind: "rect",
      x: px,
      y: py + ph * 0.45,
      w: pw,
      h: ph * 0.55,
      fill: {
        type: "linear",
        x0: px,
        y0: py + ph * 0.45,
        x1: px,
        y1: py + ph,
        stops: [
          { offset: 0, color: "rgba(0,0,0,0)" },
          { offset: 1, color: "rgba(0,0,0,0.5)" },
        ],
      },
    });
    nodes.push({ kind: "group", clip: { x: px, y: py, w: pw, h: ph, r: 4 }, children: photo });

    // Corner tag from the kicker.
    if (c.slide.kicker && c.slide.kicker.trim()) {
      nodes.push(
        ...D.chip(c, c.slide.kicker, {
          x: px + 22,
          y: py + 22,
          size: 16,
          fill: withAlpha("#ffffff", 0.85),
          color: "#151515",
          letterSpacing: 1.5,
          radius: 6,
        }).nodes,
      );
    }

    // Headline printed over the photo, bottom-left, upright.
    const title = block(c, c.slide.title || "", {
      x: px + 30,
      y: 0,
      w: pw - 60,
      maxH: ph * 0.5,
      font: c.fonts.sans,
      weight: 800,
      max: 92,
      min: 34,
      lineHeight: 1.05,
      align: "left",
      color: "#ffffff",
      letterSpacing: -1,
      marks: {},
    });
    nodes.push({ ...title.node, y: py + ph - title.height - 30 });

    // Hand caption on the strip.
    const stripTop = frameY + frameH - strip;
    const caption =
      (c.slide.body && c.slide.body.trim()) ||
      (c.slide.note && c.slide.note.trim()) ||
      (c.deck.handle && c.deck.handle.trim()) ||
      c.slide.title ||
      " ";
    const cap = block(c, caption, {
      x: px,
      y: 0,
      w: pw,
      maxH: strip - 66,
      font: c.fonts.hand,
      weight: 700,
      max: 40,
      min: 18,
      lineHeight: 1.2,
      align: "center",
      color: "#1b1b1b",
      marks: {},
    });
    nodes.push({ ...cap.node, y: stripTop + (strip - 40 - cap.height) / 2 + 8 });

    // A small hand index in the strip corner.
    nodes.push(
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: px,
        y: frameY + frameH - 42,
        w: pw,
        size: 18,
        font: c.fonts.hand,
        weight: 700,
        color: withAlpha("#1b1b1b", 0.55),
        align: "right",
        marks: {},
      }).node,
    );

    nodes.push(D.grain(c, 0.03, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------- Doodle ------------------------------- */

export const doodle: Preset = {
  id: "doodle",
  name: "Doodle",
  category: "playful",
  blurb: "A sketchbook page — hand kicker, a word ringed in ink, arrows nudging the notes.",
  defaultPalette: "paper",
  palettes: ["paper", "notebook", "candy", "highlighter"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "A marker-on-paper sketch. A hand-scrawled `kicker`, a short title (3-8 words) where one strong word gets circled, an optional line, and two to four quick bullets the arrows point at. Loose, warm and hand-drawn.",
  slideRange: [5, 9],
  pad: 88,
  render(c) {
    const nodes: Node[] = [];
    const box = bodyBox(c, 96);
    const accent = c.pal.accent;

    // Sketch-paper ground.
    nodes.push(...D.dotGrid(c, 52, 2, withAlpha(c.pal.fg, 0.08)));

    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      gap: 28,
      kickerFont: "hand",
      kickerUpper: false,
      kickerWeight: 700,
      kickerSize: 34,
      kickerLS: 0,
      kickerColor: accent,
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 92,
      titleMin: 38,
      titleLH: 1.08,
      titleLS: -1,
      titleColor: c.pal.fg,
      bodyFont: "sans",
      bodyWeight: 400,
      bodySize: 29,
      bodyLH: 1.4,
      bodyColor: c.pal.muted,
      bullet: "dash",
      bulletColor: accent,
      bulletGap: 24,
    });

    // Custom title so we can ring one of its words by hand.
    const titleBlk = block(c, c.slide.title || "", {
      x: box.x,
      y: 0,
      w: box.w,
      maxH: box.h * 0.4,
      font: c.fonts.sans,
      weight: 800,
      max: 92,
      min: 38,
      lineHeight: 1.08,
      align: "left",
      color: c.pal.fg,
      letterSpacing: -1,
      marks: s.marks,
    });
    const titlePartCustom: Part = { h: titleBlk.height, draw: (y) => [{ ...titleBlk.node, y }] };

    const kick = kickerPart(c, s, box);
    const bulletsP = bulletsPart(c, s, box);
    const pl = placed(
      [kick, titlePartCustom, bodyPart(c, s, box), bulletsP, notePart(c, s, box)],
      box,
      s.gap,
      "center",
    );
    for (const { part, y } of pl) nodes.push(...part.draw(y));

    // Ring the last word of the title's final line.
    const tEntry = pl.find((e) => e.part === titlePartCustom);
    if (tEntry) {
      const lines = titleBlk.node.lines;
      const line = lines[lines.length - 1];
      if (line && line.tokens.length) {
        const size = titleBlk.size;
        const lh = titleBlk.node.lineHeight;
        const space = textWidth(c, " ", c.fonts.sans, size, 800, -1);
        let x = box.x;
        let target = { x: box.x, w: size };
        line.tokens.forEach((tok, i) => {
          const w = textWidth(c, tok.text, c.fonts.sans, size, 800, -1);
          if (i === line.tokens.length - 1) target = { x, w };
          x += w + space;
        });
        const lineY = tEntry.y + (lines.length - 1) * size * lh;
        nodes.push(
          D.sketchCircle(
            c,
            target.x + target.w / 2,
            lineY + size * 0.52,
            Math.max(28, target.w / 2 + 16),
            Math.max(20, size * 0.72),
            accent,
            5,
          ),
        );
      }
    }

    // Hand underline beneath the kicker.
    const kEntry = kick ? pl.find((e) => e.part === kick) : undefined;
    if (c.slide.kicker && kick && kEntry) {
      const kw = textWidth(c, c.slide.kicker, c.fonts.hand, s.kickerSize, s.kickerWeight, s.kickerLS);
      const ulW = Math.min(box.w * 0.6, Math.max(80, kw));
      nodes.push(...D.sketchUnderline(c, box.x, kEntry.y + kick.h + 4, ulW, accent, 5));
    }

    // A curved arrow nudging the first bullet from the left margin.
    const bEntry = bulletsP ? pl.find((e) => e.part === bulletsP) : undefined;
    if (bulletsP && bEntry) {
      const n = c.slide.bullets?.length ?? 1;
      const bsize = Math.min(s.bodySize, Math.max(24, 40 - n * 1.6));
      const midY = bEntry.y + bsize * 0.66;
      nodes.push(
        ...D.curvedArrow(
          [box.x - 30, bEntry.y - 12],
          [box.x + bsize * 0.34, midY],
          34,
          withAlpha(accent, 0.9),
          4,
        ),
      );
    }

    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.03, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

export const FUN_PRESETS: Preset[] = [memo, arcade, polaroid, doodle];
