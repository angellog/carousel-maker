import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyBox,
  bulletsPart,
  composeStack,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
  bodyPart,
} from "./_shared";
import type { Preset } from "./types";

/* --------------------------- 06 · Chalkboard --------------------------- */

export const chalkboard: Preset = {
  id: "chalkboard",
  name: "Chalkboard",
  category: "playful",
  blurb: "Green board, chalk lettering, sketch doodles and a banner strip.",
  defaultPalette: "chalk",
  palettes: ["chalk", "forest", "midnight"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Warm, teacherly voice. Title is a claim a teacher would write on the board (4–10 words). Bullets are short phrases, not sentences. `note` is a one-line takeaway for the bottom banner.",
  slideRange: [7, 10],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    // Board surface: subtle radial lightening plus chalk dust.
    nodes.push({
      kind: "rect",
      x: 0,
      y: 0,
      w: c.w,
      h: c.h,
      fill: {
        type: "radial",
        cx: c.w * 0.42,
        cy: c.h * 0.36,
        r: c.w * 0.95,
        stops: [
          { offset: 0, color: withAlpha("#ffffff", 0.07) },
          { offset: 1, color: withAlpha("#000000", 0.18) },
        ],
      },
    });
    // Header rule
    nodes.push(
      fixedBlock(c, (c.deck.handle || "").toUpperCase(), {
        x: cb.x,
        y: cb.y - 34,
        w: cb.w / 2,
        size: 22,
        font: c.fonts.hand,
        weight: 700,
        color: withAlpha(c.pal.fg, 0.6),
        letterSpacing: 1.5,
        marks: {},
      }).node,
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x + cb.w - 120,
        y: cb.y - 34,
        w: 120,
        size: 22,
        font: c.fonts.hand,
        weight: 700,
        color: withAlpha(c.pal.fg, 0.6),
        align: "right",
        marks: {},
      }).node,
    );

    const bannerH = c.slide.note ? 108 : 0;
    const box = { x: cb.x, y: cb.y + 18, w: cb.w * 0.7, h: cb.h - bannerH - 60 };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "hand",
      titleWeight: 700,
      titleMax: 116,
      titleMin: 46,
      titleLH: 1.0,
      titleLS: 0,
      bodyFont: "hand",
      bodySize: 34,
      bodyLH: 1.3,
      bodyColor: withAlpha(c.pal.fg, 0.82),
      kickerFont: "hand",
      kickerSize: 26,
      kickerLS: 2,
      kickerColor: c.pal.accent,
      bullet: "dash",
      bulletColor: c.pal.accent,
      bulletGap: 22,
      gap: 30,
      marks: {
        accent: { color: c.pal.accent, weight: 700 },
        highlight: { color: c.pal.accent2, weight: 700 },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    const title = titlePart(c, s, box);
    const parts = [kickerPart(c, s, box), title, bodyPart(c, s, box), bulletsPart(c, s, box)];
    nodes.push(...layoutParts(parts, box, s.gap, s.justify));

    // Chalk underline beneath the headline block.
    if (title) {
      const ys = box.y + (box.h - parts.filter(Boolean).reduce((a, p) => a + (p?.h ?? 0), 0) - s.gap * (parts.filter(Boolean).length - 1)) / 2;
      const underY = ys + (parts[0]?.h ?? 0) + (parts[0] ? s.gap : 0) + title.h + 12;
      nodes.push(...D.sketchUnderline(c, box.x, underY, Math.min(box.w * 0.62, 420), c.pal.accent, 7));
    }

    // Doodles in the right-hand gutter.
    const gutterX = cb.x + cb.w * 0.74;
    const seeds = [c.slide.title, c.slide.body ?? c.deck.topic, c.slide.kicker ?? c.deck.angle];
    seeds.forEach((seed, i) => {
      const g = P.icon(iconFor(seed), gutterX + (i % 2) * 24, cb.y + 60 + i * 190, 118, withAlpha(c.pal.fg, 0.55), {
        width: 4,
      });
      if (g) nodes.push({ ...g, rotate: (c.rand() - 0.5) * 0.24, origin: [gutterX + 60, cb.y + 120 + i * 190] });
    });
    nodes.push(...D.sketchUnderline(c, gutterX - 10, cb.y + 40, 150, withAlpha(c.pal.accent2, 0.5), 4));

    // Bottom banner strip.
    if (c.slide.note) {
      const by = c.h - c.pad - bannerH + 20;
      nodes.push({
        kind: "rect",
        x: cb.x,
        y: by,
        w: cb.w,
        h: 84,
        r: 42,
        stroke: c.pal.accent,
        lineWidth: 4,
      });
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x + 40,
          y: by + 26,
          w: cb.w - 80,
          size: 30,
          font: c.fonts.hand,
          weight: 700,
          color: c.pal.accent,
          align: "center",
          uppercase: true,
          letterSpacing: 1.5,
          marks: {},
        }).node,
      );
    }
    nodes.push(D.grain(c, 0.085, "#ffffff"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 07 · Notebook ---------------------------- */

export const notebook: Preset = {
  id: "notebook",
  name: "Notebook",
  category: "playful",
  blurb: "Ruled page with spiral binding, ink handwriting and a boxed definition.",
  defaultPalette: "notebook",
  palettes: ["notebook", "cream", "paper"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Study-notes voice: define, then list. Title is a question or a term ('What is X?'). Bullets read like revision notes — short, factual, one clause. `body` is the definition to put in the highlighted box.",
  slideRange: [8, 10],
  pad: 96,
  render(c) {
    const nodes: Node[] = [];
    nodes.push(
      ...P.ruledPage(c, {
        paper: c.pal.bg,
        rule: c.pal.line,
        ruleStep: 54,
        spiral: true,
        margin: true,
        marginColor: withAlpha(c.pal.accent2, 0.45),
      }),
    );
    const left = c.pad + 78;
    const cb = { x: left, y: c.pad, w: c.w - left - c.pad, h: c.h - c.pad * 2 };

    // Handwritten page tab.
    nodes.push(
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x + cb.w - 140,
        y: cb.y - 46,
        w: 140,
        size: 30,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent,
        align: "right",
        marks: {},
      }).node,
    );

    const flowH = 150;
    const box = { x: cb.x, y: cb.y + 10, w: cb.w, h: cb.h - flowH - 70 };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "hand",
      titleWeight: 700,
      titleMax: 96,
      titleMin: 44,
      titleLH: 1.06,
      titleLS: 0,
      titleColor: c.pal.fg,
      bodyFont: "hand",
      bodySize: 32,
      bodyLH: 1.34,
      bodyColor: c.pal.fg,
      kickerFont: "hand",
      kickerSize: 26,
      kickerColor: c.pal.accent2,
      kickerLS: 1,
      bullet: "dot",
      bulletColor: c.pal.accent,
      bulletGap: 20,
      gap: 26,
      marks: {
        accent: { color: c.pal.accent, weight: 700 },
        highlight: { highlight: withAlpha(c.pal.accent2, 0.25) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });

    const kick = kickerPart(c, s, box);
    const title = titlePart(c, s, box, undefined, box.h * 0.36);
    const bullets = bulletsPart(c, s, box);

    let y = box.y;
    if (kick) {
      nodes.push(...kick.draw(y));
      y += kick.h + 14;
    }
    if (title) {
      nodes.push(...title.draw(y));
      y += title.h + 10;
      nodes.push(...D.sketchUnderline(c, box.x, y, Math.min(box.w * 0.7, 460), withAlpha(c.pal.accent, 0.7), 6));
      y += 34;
    }
    if (bullets) {
      nodes.push(...bullets.draw(y));
      y += bullets.h + 30;
    }
    // Boxed definition callout.
    if (c.slide.body) {
      const inner = fixedBlock(c, c.slide.body, {
        x: box.x + 30,
        y: 0,
        w: box.w - 60,
        size: 30,
        font: c.fonts.hand,
        weight: 600,
        color: c.pal.fg,
        lineHeight: 1.34,
        marks: s.marks,
      });
      const h = inner.height + 52;
      const yy = Math.min(y, box.y + box.h - h);
      nodes.push(
        { kind: "rect", x: box.x, y: yy, w: box.w, h, r: 18, fill: c.pal.surface, stroke: c.pal.accent, lineWidth: 3 },
        { ...inner.node, y: yy + 26 },
      );
    }

    // Icon flow row along the foot of the page.
    const fy = c.h - c.pad - flowH + 40;
    const seeds = (c.slide.bullets && c.slide.bullets.length >= 3
      ? c.slide.bullets
      : [c.deck.topic, c.slide.title, c.slide.body ?? c.deck.angle, c.slide.kicker ?? c.deck.audience]
    ).slice(0, 4);
    const step = cb.w / seeds.length;
    seeds.forEach((seed, i) => {
      const cx = cb.x + step * i + step / 2;
      const g = P.icon(iconFor(seed), cx - 40, fy, 80, c.pal.accent, { width: 4 });
      if (g) nodes.push(g);
      if (i < seeds.length - 1) {
        nodes.push(D.arrow(cx + 48, fy + 40, step - 96, withAlpha(c.pal.accent2, 0.8), 3));
      }
    });
    // Circled page number.
    nodes.push(
      { kind: "ellipse", cx: c.w / 2, cy: c.h - c.pad + 16, rx: 24, ry: 24, stroke: c.pal.accent, lineWidth: 3 },
      fixedBlock(c, String(c.index + 1), {
        x: c.w / 2 - 24,
        y: c.h - c.pad + 1,
        w: 48,
        size: 26,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent,
        align: "center",
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.04, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 08 · Pastel Note --------------------------- */

export const pastelnote: Preset = {
  id: "pastelnote",
  name: "Pastel Note",
  category: "playful",
  blurb: "Soft pastel ground, big step badge, marker headline, one large doodle.",
  defaultPalette: "lavender",
  palettes: ["lavender", "candy", "clay", "slate"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Friendly explainer voice. Each body slide is one numbered concept: a 3–7 word headline, a one-sentence explanation, and up to three short bullets.",
  slideRange: [8, 10],
  pad: 88,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.dotGrid(c, 56, 2.5, withAlpha(c.pal.accent, 0.1)));

    const isCover = c.slide.role === "cover";
    const badgeR = 46;
    if (!isCover) {
      nodes.push(
        ...D.numberBadge(c, c.index, cb.x + badgeR, cb.y + badgeR, badgeR, {
          fill: c.pal.accent,
          color: "#ffffff",
        }),
      );
    }

    const topOffset = isCover ? 0 : badgeR * 2 + 34;
    const noteH = c.slide.note ? 120 : 0;
    const box = {
      x: cb.x,
      y: cb.y + topOffset,
      w: cb.w * 0.66,
      h: cb.h - topOffset - noteH - 40,
    };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: isCover ? 106 : 82,
      titleMin: 40,
      titleLH: 1.06,
      titleLS: -1.5,
      bodySize: 30,
      bodyLH: 1.42,
      bodyColor: c.pal.muted,
      kickerSize: 22,
      kickerLS: 3,
      kickerColor: c.pal.accent2,
      bullet: "check",
      bulletColor: c.pal.accent,
      bulletGap: 22,
      gap: 26,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: withAlpha(c.pal.accent2, 0.3) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(...composeStack(c, { ...s, gap: 26 }, { ...box, h: box.h }));

    // Oversized doodle bleeding off the right edge.
    const g = P.icon(iconFor(c.slide.title), cb.x + cb.w - 230, cb.y + cb.h * 0.42, 280, withAlpha(c.pal.accent, 0.28), {
      width: 8,
    });
    if (g) nodes.push({ ...g, rotate: -0.12, origin: [cb.x + cb.w - 90, cb.y + cb.h * 0.56] });

    if (c.slide.note) {
      const ny = c.h - c.pad - 96;
      nodes.push({ kind: "rect", x: cb.x, y: ny, w: cb.w, h: 84, r: 22, fill: c.pal.surface });
      const bulb = P.icon("bulb", cb.x + 22, ny + 18, 48, c.pal.accent2, { width: 4 });
      if (bulb) nodes.push(bulb);
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x + 90,
          y: ny + 26,
          w: cb.w - 116,
          size: 26,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          lineHeight: 1.25,
          marks: s.marks,
        }).node,
      );
    }
    nodes.push(...D.footer(c, { y: c.h - 46 }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* -------------------------- 09 · Doodle Mascot -------------------------- */

/** Little ink blob character with eyes and feet. */
function blob(c: Ctx, x: number, y: number, s: number, color: string): Node[] {
  const eye = (dx: number) => ({
    kind: "ellipse" as const,
    cx: x + s * dx,
    cy: y + s * 0.42,
    rx: s * 0.052,
    ry: s * 0.075,
    fill: "#ffffff",
  });
  return [
    {
      kind: "path",
      d: `M ${x} ${y + s} C ${x - s * 0.42} ${y + s} ${x - s * 0.46} ${y + s * 0.42} ${x - s * 0.34} ${y + s * 0.18} C ${x - s * 0.24} ${y - s * 0.04} ${x + s * 0.24} ${y - s * 0.04} ${x + s * 0.34} ${y + s * 0.18} C ${x + s * 0.46} ${y + s * 0.42} ${x + s * 0.42} ${y + s} ${x} ${y + s} Z`,
      fill: color,
    },
    eye(-0.12),
    eye(0.12),
    { kind: "line", x1: x - s * 0.16, y1: y + s, x2: x - s * 0.2, y2: y + s * 1.14, stroke: color, lineWidth: s * 0.045, cap: "round" },
    { kind: "line", x1: x + s * 0.16, y1: y + s, x2: x + s * 0.2, y2: y + s * 1.14, stroke: color, lineWidth: s * 0.045, cap: "round" },
  ];
}

export const doodlemascot: Preset = {
  id: "doodlemascot",
  name: "Doodle Mascot",
  category: "playful",
  blurb: "White page, colour-coded headline words and a little ink character.",
  defaultPalette: "slate",
  palettes: ["slate", "ink", "candy", "notebook"],
  needs: ["kicker", "body", "note"],
  brief:
    "Punchy and conversational. Title 5–10 words with **accent** marking the two or three words that carry the hook. `note` becomes the mascot's speech bubble — make it a wry aside of 4–9 words.",
  slideRange: [7, 10],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const mascotH = 300;
    const box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - mascotH };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: 112,
      titleMin: 44,
      titleLH: 1.04,
      titleLS: -2,
      bodySize: 30,
      bodyLH: 1.4,
      bodyColor: c.pal.muted,
      kickerSize: 22,
      kickerLS: 3,
      bullet: "arrow",
      gap: 26,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { color: c.pal.accent2, weight: 800 },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(...layoutParts([kickerPart(c, s, box), titlePart(c, s, box), bodyPart(c, s, box), featurePart(c, s, box)], box, s.gap, "start"));

    // Mascot + speech bubble.
    const mx = cb.x + 110;
    const my = c.h - c.pad - 190;
    nodes.push(...blob(c, mx, my, 150, c.pal.fg));
    if (c.slide.note) {
      nodes.push(
        ...P.speechBubble(c, c.slide.note, {
          x: mx + 118,
          y: my - 34,
          w: Math.min(cb.w - (mx - cb.x) - 130, 430),
          size: 27,
          font: c.fonts.hand,
          fill: c.pal.surface,
          stroke: c.pal.fg,
          color: c.pal.fg,
          tail: "bl",
          rotate: 0.02,
        }),
      );
    }
    // Small doodle cards trailing to the right.
    for (let i = 0; i < 3; i++) {
      const dx = cb.x + cb.w - 300 + i * 88;
      const dy = c.h - c.pad - 150 + (i % 2) * 30;
      nodes.push({
        kind: "rect",
        x: dx,
        y: dy,
        w: 74,
        h: 92,
        r: 12,
        stroke: c.pal.fg,
        lineWidth: 3,
        fill: c.pal.bg,
        rotate: (i - 1) * 0.14,
        origin: [dx + 37, dy + 46],
      });
      const g = P.icon(iconFor(`${c.slide.title}${i}`), dx + 19, dy + 26, 36, c.pal.accent, { width: 3.5 });
      if (g) nodes.push({ ...g, rotate: (i - 1) * 0.14, origin: [dx + 37, dy + 46] });
    }
    nodes.push(...D.footer(c, { y: c.h - 44 }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* -------------------------- 10 · Paper Collage -------------------------- */

export const papercollage: Preset = {
  id: "papercollage",
  name: "Paper Collage",
  category: "playful",
  blurb: "Taped labels, card panels and a rotated sticky note on cream stock.",
  defaultPalette: "clay",
  palettes: ["clay", "paper", "cream", "parchment"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Workbook voice. `kicker` is a short label ('TERM #1', 'STEP 2'). Title is the term itself, 1–4 words. `body` explains it in one sentence. `note` is the sticky-note analogy — plain-English, 6–14 words.",
  slideRange: [8, 10],
  pad: 84,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.07, "#8a7250"));

    nodes.push(
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x,
        y: cb.y - 30,
        w: 140,
        size: 24,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        marks: {},
      }).node,
    );

    let y = cb.y + 24;
    if (c.slide.kicker) {
      nodes.push(...P.tapeLabel(c, c.slide.kicker, cb.x + cb.w - 300, cb.y - 6, { angle: 0.05, size: 21 }));
    }

    // Marker-outlined headline.
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.9,
      size: 92,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.02,
      letterSpacing: -2,
      uppercase: true,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: withAlpha(c.pal.accent, 0.28) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 18;
    nodes.push(...D.sketchUnderline(c, cb.x, y, Math.min(cb.w * 0.5, 380), c.pal.accent, 8));
    y += 44;

    // Card panel holding body + bullets.
    const s = defaultShell(c, {
      align: "left",
      bodySize: 29,
      bodyLH: 1.4,
      bodyColor: c.pal.fg,
      bullet: "dot",
      bulletColor: c.pal.accent,
      bulletGap: 18,
    });
    const inner = { x: cb.x + 34, y: 0, w: cb.w * 0.62 - 68, h: 400 };
    const b = bodyPart(c, s, inner);
    const bl = bulletsPart(c, s, inner);
    const cardH = (b?.h ?? 0) + (bl ? bl.h + 24 : 0) + 60;
    if (b || bl) {
      nodes.push(D.card(c, cb.x, y, cb.w * 0.62, cardH, { fill: c.pal.surface, radius: 20, stroke: withAlpha(c.pal.fg, 0.18) }));
      let iy = y + 30;
      if (b) {
        nodes.push(...b.draw(iy));
        iy += b.h + 24;
      }
      if (bl) nodes.push(...bl.draw(iy));
    }

    // Rotated sticky note.
    if (c.slide.note) {
      const sw = 300;
      const sx = cb.x + cb.w - sw + 10;
      const sy = y + cardH * 0.45;
      const noteText = fixedBlock(c, c.slide.note, {
        x: sx + 26,
        y: 0,
        w: sw - 52,
        size: 27,
        font: c.fonts.hand,
        weight: 600,
        color: "#3a2f18",
        lineHeight: 1.28,
        marks: {},
      });
      const sh = noteText.height + 60;
      const origin: [number, number] = [sx + sw / 2, sy + sh / 2];
      nodes.push(
        {
          kind: "rect",
          x: sx,
          y: sy,
          w: sw,
          h: sh,
          fill: "#ffe680",
          rotate: 0.06,
          origin,
          shadow: { color: "rgba(0,0,0,0.2)", blur: 24, x: 0, y: 10 },
        },
        { ...noteText.node, y: sy + 30, rotate: 0.06, origin },
        D.tape(c, sx + sw / 2 - 52, sy - 18, 104, 0.06),
      );
    }

    // Pill CTAs along the bottom.
    const pills: [string, string][] = [
      ["SAVE THIS", c.pal.accent],
      [c.deck.handle ? `FOLLOW ${c.deck.handle}` : "FOLLOW FOR MORE", c.pal.fg],
    ];
    let px = cb.x;
    for (const [label, col] of pills) {
      const ch = D.chip(c, label, {
        x: px,
        y: c.h - c.pad - 6,
        size: 21,
        fill: col,
        color: c.pal.bg,
        letterSpacing: 1.5,
      });
      nodes.push(...ch.nodes);
      px += ch.w + 16;
    }
    return scene(c, c.pal.bg, nodes);
  },
};
