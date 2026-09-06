import type { Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  bulletsPart,
  composeStack,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* ---------------------------- 11 · Retro 3D ---------------------------- */

export const retro3d: Preset = {
  id: "retro3d",
  name: "Retro 3D",
  category: "bold",
  blurb: "Chunky extruded display type with a hard offset shadow and sparkles.",
  defaultPalette: "candy",
  palettes: ["candy", "cream", "sunset", "amber", "electric"],
  needs: ["kicker", "body", "note"],
  brief:
    "Loud and short. Title is 2–6 words, ideally one or two lines — it is set as a poster, not a sentence. `body` is one supporting line. `kicker` is a tiny label such as a number or category.",
  slideRange: [7, 9],
  pad: 88,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];

    nodes.push({
      kind: "rect",
      x: 0,
      y: 0,
      w: c.w,
      h: c.h,
      fill: {
        type: "radial",
        cx: c.w * 0.5,
        cy: c.h * 0.34,
        r: c.w * 0.85,
        stops: [
          { offset: 0, color: withAlpha(c.pal.accent2, 0.22) },
          { offset: 1, color: withAlpha(c.pal.accent2, 0) },
        ],
      },
    });

    let y = cb.y;
    if (c.slide.kicker) {
      const probe = D.chip(c, c.slide.kicker, {
        x: 0,
        y: 0,
        size: 22,
        fill: c.pal.fg,
        color: c.pal.bg,
        letterSpacing: 2,
      });
      nodes.push(
        ...D.chip(c, c.slide.kicker, {
          x: (c.w - probe.w) / 2,
          y,
          size: 22,
          fill: c.pal.fg,
          color: c.pal.bg,
          letterSpacing: 2,
        }).nodes,
      );
      y += probe.h + 30;
    }

    // Reserve room for the body, then let the headline take everything else.
    // Sizing goes through the shared fitter so the text re-wraps at each trial
    // size — scaling a single probe linearly under-sizes badly.
    const bodyReserve = c.slide.body ? 130 : 0;
    const panelReserve = 300;
    const titleBox = {
      x: cb.x,
      y,
      w: cb.w,
      h: cb.h - (y - cb.y) - bodyReserve - panelReserve,
    };
    const fitted = block(c, c.slide.title, {
      x: titleBox.x,
      y: titleBox.y,
      w: titleBox.w,
      maxH: titleBox.h,
      font: c.fonts.display,
      weight: 800,
      max: 150,
      min: 46,
      lineHeight: 1.02,
      align: "center",
      uppercase: true,
      maxLines: 4,
      marks: {},
    });
    nodes.push(
      ...P.extrudeText(c, c.slide.title.toUpperCase(), {
        x: titleBox.x,
        y: titleBox.y + Math.max(0, (titleBox.h - fitted.height) / 2),
        w: titleBox.w,
        size: fitted.size,
        font: c.fonts.display,
        weight: 800,
        align: "center",
        lineHeight: 1.02,
        face: c.pal.accent,
        // A single hard offset in the ink colour reads far better than an
        // outline ring, which merges the counters at display sizes.
        shadow: c.pal.fg,
        depth: Math.max(7, fitted.size * 0.085),
      }),
    );
    y = titleBox.y + Math.max(0, (titleBox.h - fitted.height) / 2) + fitted.height + 34;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x + cb.w * 0.06,
        y,
        w: cb.w * 0.88,
        size: 29,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.fg,
        align: "center",
        lineHeight: 1.38,
        marks: {
          accent: { color: c.pal.accent, weight: 800 },
          highlight: { highlight: withAlpha(c.pal.accent2, 0.3) },
          underline: { underline: c.pal.accent },
          strike: { strike: c.pal.muted, color: c.pal.muted },
        },
      });
      nodes.push(b.node);
      y += b.height + 26;
    }

    // Bullets take priority over the decorative panel when the slide has them.
    const zoneH = c.h - c.pad - 76 - y;
    const bullets = c.slide.bullets ?? [];
    if (bullets.length && zoneH > 120) {
      const rowH = Math.min(78, zoneH / bullets.length);
      bullets.forEach((text, i) => {
        const ry = y + i * rowH;
        nodes.push({
          kind: "rect",
          x: cb.x + 16,
          y: ry,
          w: cb.w - 32,
          h: rowH - 12,
          r: 16,
          fill: withAlpha(c.pal.fg, 0.06),
          stroke: c.pal.accent,
          lineWidth: 3,
        });
        nodes.push(
          fixedBlock(c, text, {
            x: cb.x + 40,
            y: ry + (rowH - 12) / 2 - 15,
            w: cb.w - 80,
            size: 25,
            font: c.fonts.sans,
            weight: 700,
            color: c.pal.fg,
            align: "center",
            lineHeight: 1.15,
            marks: {},
          }).node,
        );
      });
    } else if (zoneH > 170) {
      nodes.push(
        { kind: "rect", x: cb.x + 20, y, w: cb.w - 40, h: zoneH - 12, r: 22, fill: withAlpha(c.pal.fg, 0.05), stroke: c.pal.accent, lineWidth: 4 },
        ...P.windowCard(c, cb.x + 62, y + 36, cb.w - 124, zoneH - 84, { rows: 4, accent: c.pal.accent2 }),
      );
    }

    nodes.push(
      ...P.sparkleField(c, withAlpha(c.pal.accent2, 0.8), 8, {
        min: 14,
        max: 34,
        avoid: { x: cb.x, y: titleBox.y - 10, w: cb.w, h: titleBox.h + 20 },
      }),
    );
    nodes.push(...D.footer(c, { y: c.h - c.pad + 22, color: c.pal.fg }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 12 · Flat Colour --------------------------- */

export const flatcolor: Preset = {
  id: "flatcolor",
  name: "Flat Colour",
  category: "bold",
  blurb: "One saturated field, black type, inverted label bars. Nothing else.",
  defaultPalette: "amber",
  palettes: ["amber", "candy", "electric", "forest", "sunset"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Essay-in-slides voice. `kicker` is a short framing label rendered as an inverted bar ('The old formula was:'). `body` carries two or three short paragraphs separated by a blank line — this preset gives them room.",
  slideRange: [8, 10],
  pad: 108,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const marks = {
      accent: { color: c.pal.accent2, weight: 800 },
      highlight: { highlight: withAlpha(c.pal.fg, 0.18) },
      underline: { underline: c.pal.fg },
      strike: { strike: withAlpha(c.pal.fg, 0.6), color: withAlpha(c.pal.fg, 0.6) },
    };

    let y = cb.y + 34;
    if (c.slide.kicker) {
      const size = 26;
      const tw = textWidth(c, c.slide.kicker, c.fonts.sans, size, 700, 0.4);
      nodes.push(
        { kind: "rect", x: cb.x - 8, y, w: tw + 30, h: size * 1.72, fill: c.pal.fg },
        fixedBlock(c, c.slide.kicker, {
          x: cb.x + 7,
          y: y + size * 0.36,
          w: tw + 8,
          size,
          font: c.fonts.sans,
          weight: 700,
          color: c.pal.bg,
          letterSpacing: 0.4,
          marks: {},
        }).node,
      );
      y += size * 1.72 + 40;
    }

    const box = { x: cb.x, y, w: cb.w, h: c.h - c.pad - 70 - y };
    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleFont: "sans",
      titleWeight: 800,
      titleMax: c.slide.role === "cover" ? 104 : 62,
      titleMin: 34,
      titleLH: 1.12,
      titleLS: -1.2,
      bodyFont: "sans",
      bodySize: 32,
      bodyLH: 1.62,
      bodyColor: c.pal.fg,
      bullet: "dash",
      bulletColor: c.pal.fg,
      bulletGap: 24,
      gap: 34,
      marks,
    });
    nodes.push(
      ...layoutParts(
        [titlePart(c, s, box, undefined, box.h * 0.4), bodyPart(c, s, box), featurePart(c, s, box), notePart(c, s, box)],
        box,
        s.gap,
        "start",
      ),
    );

    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 6,
        w: cb.w * 0.6,
        size: 22,
        font: c.fonts.sans,
        weight: 700,
        color: withAlpha(c.pal.fg, 0.55),
        marks: {},
      }).node,
      fixedBlock(c, `${c.index + 1}`, {
        x: cb.x + cb.w - 80,
        y: c.h - c.pad + 6,
        w: 80,
        size: 22,
        font: c.fonts.mono,
        weight: 700,
        color: withAlpha(c.pal.fg, 0.55),
        align: "right",
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 13 · Prompt Card --------------------------- */

export const promptcard: Preset = {
  id: "promptcard",
  name: "Prompt Card",
  category: "technical",
  blurb: "Dark stock, highlighter headline bar, a bordered prompt block, crop marks.",
  defaultPalette: "highlighter",
  palettes: ["highlighter", "midnight", "terminal", "electric"],
  needs: ["kicker", "body", "code", "note"],
  brief:
    "Each body slide delivers one copy-pasteable asset. Title is 2–5 words naming the job. `code` holds the actual prompt or command, 3–8 short lines. `note` is the one-line rule of thumb at the foot.",
  slideRange: [8, 10],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...P.cropMarks(c, 46, 34, withAlpha(c.pal.fg, 0.3), 2));

    let y = cb.y;
    const idx = String(c.index).padStart(2, "0");
    if (c.slide.role !== "cover") {
      const n = fixedBlock(c, idx, {
        x: cb.x,
        y,
        w: 200,
        size: 62,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        letterSpacing: -2,
        marks: {},
      });
      nodes.push(n.node);
      y += n.height + 16;
    }

    // Headline: last line sits on a solid highlighter bar.
    const lines = c.slide.title.split("\n");
    const head = lines[0];
    const barLine = lines[1] ?? "";
    const t = fixedBlock(c, head, {
      x: cb.x,
      y,
      w: cb.w,
      size: c.slide.role === "cover" ? 96 : 72,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.05,
      letterSpacing: -2,
      uppercase: true,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: c.pal.accent, color: "#0b0b0c" },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 8;
    if (barLine) {
      const size = c.slide.role === "cover" ? 96 : 72;
      const tw = textWidth(c, barLine.toUpperCase(), c.fonts.sans, size, 800, -2);
      nodes.push(
        { kind: "rect", x: cb.x - 10, y: y + size * 0.1, w: Math.min(cb.w, tw + 34), h: size * 1.02, fill: c.pal.accent },
        fixedBlock(c, barLine, {
          x: cb.x + 6,
          y: y + size * 0.16,
          w: cb.w,
          size,
          font: c.fonts.sans,
          weight: 800,
          color: "#0b0b0c",
          letterSpacing: -2,
          uppercase: true,
          lineHeight: 1.02,
          marks: {},
        }).node,
      );
      y += size * 1.22;
    }

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y: y + 14,
        w: cb.w,
        size: 28,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.4,
        marks: {
          accent: { color: c.pal.accent, weight: 700 },
          highlight: { highlight: withAlpha(c.pal.accent, 0.3) },
          underline: { underline: c.pal.accent },
          strike: { strike: c.pal.muted, color: c.pal.muted },
        },
      });
      nodes.push(b.node);
      y += b.height + 30;
    }

    // Bordered prompt block.
    const noteH = c.slide.note ? 76 : 0;
    const blockTop = y + 12;
    const blockH = c.h - c.pad - noteH - 46 - blockTop;
    if (blockH > 120) {
      nodes.push({
        kind: "rect",
        x: cb.x,
        y: blockTop,
        w: cb.w,
        h: blockH,
        r: 14,
        fill: c.pal.surface,
        stroke: withAlpha(c.pal.fg, 0.2),
        lineWidth: 2,
      });
      const text = c.slide.code
        ? c.slide.code.lines.join("\n")
        : (c.slide.bullets ?? []).join("\n") || c.deck.angle;
      nodes.push(
        D.quoteGlyph(c, cb.x + 22, blockTop + 6, 74, withAlpha(c.pal.accent, 0.7)),
        fixedBlock(c, text, {
          x: cb.x + 34,
          y: blockTop + 72,
          w: cb.w - 68,
          size: 24,
          font: c.fonts.mono,
          weight: 500,
          color: withAlpha(c.pal.fg, 0.9),
          lineHeight: 1.5,
          marks: {
            accent: { color: c.pal.accent, weight: 700 },
            highlight: { color: c.pal.accent2 },
            underline: { underline: c.pal.accent },
            strike: { strike: c.pal.muted, color: c.pal.muted },
          },
        }).node,
      );
      const g = P.icon(iconFor(c.slide.title), cb.x + cb.w - 116, blockTop + blockH - 116, 84, withAlpha(c.pal.accent, 0.5), { width: 4 });
      if (g) nodes.push(g);
    }

    if (c.slide.note) {
      const ny = c.h - c.pad - 62;
      nodes.push(
        { kind: "rect", x: cb.x, y: ny, w: 6, h: 46, fill: c.pal.accent },
        fixedBlock(c, c.slide.note, {
          x: cb.x + 24,
          y: ny + 8,
          w: cb.w - 24,
          size: 25,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 14,
        w: cb.w * 0.6,
        size: 20,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        marks: {},
      }).node,
      fixedBlock(c, `${String(c.index + 1).padStart(2, "0")}/${String(c.total).padStart(2, "0")}`, {
        x: cb.x + cb.w - 120,
        y: c.h - c.pad + 14,
        w: 120,
        size: 20,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        align: "right",
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 14 · Glass Chips --------------------------- */

export const glasschips: Preset = {
  id: "glasschips",
  name: "Glass Chips",
  category: "bold",
  blurb: "Dark ground, mixed-scale headline, floating pastel pills and sparkles.",
  defaultPalette: "midnight",
  palettes: ["midnight", "sunset", "electric", "highlighter"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Hooky and list-shaped. The `bullets` become floating chips, so keep each to 1–3 words (a command, a tool, a step). Title 3–8 words with **accent** on the number or key noun.",
  slideRange: [7, 9],
  pad: 88,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.meshBlobs(c, [c.pal.accent, c.pal.accent2, "#a78bfa"], 3));

    let y = cb.y + 6;
    if (c.slide.kicker) {
      const b = fixedBlock(c, c.slide.kicker, {
        x: cb.x,
        y,
        w: cb.w,
        size: 22,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.accent,
        letterSpacing: 3,
        uppercase: true,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 22;
    }

    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.94,
      size: c.slide.role === "cover" ? 102 : 82,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.02,
      letterSpacing: -2.5,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: c.pal.accent2, color: "#0a0a0a", weight: 800 },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 20;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.86,
        size: 28,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.42,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 34;
    }

    // Floating chips laid out as a wrapped row.
    const chips = c.slide.bullets ?? [];
    const pastels = ["#c4b5fd", "#a7f3d0", "#fbcfe8", "#fde68a", "#bae6fd"];
    let cx = cb.x;
    let cy = y;
    chips.forEach((label, i) => {
      const fill = pastels[i % pastels.length];
      const probe = D.chip(c, label, {
        x: 0,
        y: 0,
        size: 26,
        fill,
        color: "#141414",
        letterSpacing: 0.5,
        uppercase: false,
        padX: 26,
        padY: 16,
      });
      if (cx + probe.w > cb.x + cb.w) {
        cx = cb.x;
        cy += probe.h + 20;
      }
      const rot = (c.rand() - 0.5) * 0.1;
      const built = D.chip(c, label, {
        x: cx,
        y: cy,
        size: 26,
        fill,
        color: "#141414",
        letterSpacing: 0.5,
        uppercase: false,
        padX: 26,
        padY: 16,
      });
      nodes.push(
        ...built.nodes.map((n) => ({
          ...n,
          rotate: rot,
          origin: [cx + built.w / 2, cy + built.h / 2] as [number, number],
        })),
      );
      cx += built.w + 18;
    });

    // Handwritten annotation with a curved arrow.
    if (c.slide.note) {
      const ax = cb.x + cb.w * 0.52;
      const ay = c.h - c.pad - 132;
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: ax,
          y: ay,
          w: cb.w * 0.48,
          size: 30,
          font: c.fonts.hand,
          weight: 700,
          color: c.pal.accent2,
          lineHeight: 1.2,
          marks: {},
        }).node,
      );
      nodes.push(
        ...D.curvedArrow([ax - 20, ay + 26], [ax - 130, ay + 78], 46, c.pal.accent2, 3.5),
      );
    }
    nodes.push(...P.sparkleField(c, withAlpha(c.pal.accent, 0.85), 7, { min: 10, max: 26 }));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 15 · Dark Grid ---------------------------- */

export const darkgrid: Preset = {
  id: "darkgrid",
  name: "Dark Grid",
  category: "technical",
  blurb: "Banner strip, then bordered rows pairing a claim with a mini data panel.",
  defaultPalette: "highlighter",
  palettes: ["highlighter", "terminal", "midnight", "electric"],
  needs: ["kicker", "body", "bullets", "stat", "note"],
  brief:
    "Analytical voice. `kicker` is the deck's running banner (same on every slide). `bullets` become the rows — each 6–14 words with **accent** on the number or verdict inside it. Aim for 3–4 bullets.",
  slideRange: [8, 10],
  pad: 76,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.gridLines(c, 72, withAlpha(c.pal.fg, 0.045)));

    let y = cb.y;
    // Starred banner strip.
    if (c.slide.kicker) {
      const h = 56;
      nodes.push({ kind: "rect", x: cb.x, y, w: cb.w, h, r: 8, stroke: withAlpha(c.pal.accent, 0.7), lineWidth: 2 });
      const label = c.slide.kicker.toUpperCase();
      const tw = textWidth(c, label, c.fonts.sans, 22, 700, 2.5);
      const startX = cb.x + (cb.w - tw) / 2;
      nodes.push(
        fixedBlock(c, label, {
          x: startX,
          y: y + 16,
          w: tw + 8,
          size: 22,
          font: c.fonts.sans,
          weight: 700,
          color: c.pal.accent,
          letterSpacing: 2.5,
          marks: {},
        }).node,
        P.sparkle(startX - 26, y + h / 2, 11, c.pal.accent),
        P.sparkle(startX + tw + 26, y + h / 2, 11, c.pal.accent),
      );
      y += h + 34;
    }

    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: c.slide.role === "cover" ? 92 : 68,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.06,
      letterSpacing: -1.8,
      uppercase: true,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: c.pal.accent, color: "#0b0b0c", weight: 800 },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 26;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w,
        size: 26,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.4,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 26;
    }

    // Rows: copy on the left, a generated data panel on the right.
    const rows = (c.slide.bullets ?? []).slice(0, 4);
    const footH = 74;
    const avail = c.h - c.pad - footH - y;
    if (rows.length) {
      const gap = 16;
      const rowH = (avail - gap * (rows.length - 1)) / rows.length;
      const panelW = cb.w * 0.34;
      rows.forEach((text, i) => {
        const ry = y + i * (rowH + gap);
        nodes.push({
          kind: "rect",
          x: cb.x,
          y: ry,
          w: cb.w,
          h: rowH,
          r: 10,
          stroke: withAlpha(c.pal.fg, 0.22),
          lineWidth: 2,
        });
        nodes.push(P.sparkle(cb.x + 30, ry + rowH / 2, 12, c.pal.accent));
        nodes.push(
          fixedBlock(c, text, {
            x: cb.x + 58,
            y: ry + rowH / 2 - 30,
            w: cb.w - panelW - 86,
            size: 25,
            font: c.fonts.sans,
            weight: 500,
            color: c.pal.fg,
            lineHeight: 1.28,
            marks: {
              accent: { color: c.pal.accent, weight: 800 },
              highlight: { highlight: withAlpha(c.pal.accent, 0.3) },
              underline: { underline: c.pal.accent },
              strike: { strike: c.pal.muted, color: c.pal.muted },
            },
          }).node,
        );
        // Mini panel — alternates between a bar chart, a donut and an icon.
        const px = cb.x + cb.w - panelW - 22;
        const py = ry + 20;
        const ph = rowH - 40;
        nodes.push({ kind: "rect", x: px, y: py, w: panelW, h: ph, r: 8, fill: withAlpha(c.pal.fg, 0.05) });
        const mode = i % 3;
        if (mode === 0) {
          const vals = [3, 6, 4, 8, 5].map((v) => v + Math.floor(c.rand() * 4));
          nodes.push(...D.barChart(c, { x: px + 18, y: py + 14, w: panelW - 36, h: ph - 28 }, vals, { color: c.pal.accent, highlight: 3 }));
        } else if (mode === 1) {
          nodes.push(...D.donut(c, px + panelW / 2, py + ph / 2, Math.min(panelW, ph) / 2 - 12, 0.62, { color: c.pal.accent }));
        } else {
          nodes.push(
            ...D.sparkline(c, { x: px + 18, y: py + 16, w: panelW - 36, h: ph - 32 }, [4, 6, 5, 9, 7, 12], {
              color: c.pal.accent,
              fill: true,
            }),
          );
        }
      });
    } else if (c.slide.stat) {
      const s = defaultShell(c, { align: "left" });
      const part = featurePart(c, s, { x: cb.x, y, w: cb.w, h: avail });
      if (part) nodes.push(...part.draw(y + 20));
    }

    nodes.push(...D.footer(c, { y: c.h - c.pad + 12 }));
    return scene(c, c.pal.bg, nodes);
  },
};
