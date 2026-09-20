import type { Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as G from "../render/diagrams";
import { iconFor } from "../render/icons";
import * as P from "../render/props";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import type { SlidePanel } from "../types";
import { coverScene, defaultShell, headStack, scene } from "./_shared";
import type { Preset } from "./types";

export const contents: Preset = {
  id: "contents",
  name: "Contents",
  category: "editorial",
  blurb: "A table of contents — numbered rows, leader dots, page numbers.",
  defaultPalette: "cream",
  palettes: ["cream", "notebook", "paper", "parchment", "slate"],
  needs: ["kicker", "items", "note"],
  brief:
    "An index of what the deck covers. `items` are 6–12 rows: `label` is the topic (2–5 words) and `value` is the page or slide number it appears on.",
  slideRange: [5, 8],
  pad: 82,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.04, "#000000"));

    let y = cb.y;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: 62,
      font: c.fonts.serif,
      weight: 600,
      color: c.pal.fg,
      align: "center",
      lineHeight: 1.06,
      marks: {},
    });
    nodes.push(t.node);
    y += t.height + 14;
    if (c.slide.kicker) {
      const ch = D.chip(c, c.slide.kicker, {
        x: 0,
        y: 0,
        size: 18,
        fill: withAlpha(c.pal.accent, 0.16),
        color: c.pal.accent,
        letterSpacing: 2,
      });
      nodes.push(
        ...D.chip(c, c.slide.kicker, {
          x: (c.w - ch.w) / 2,
          y,
          size: 18,
          fill: withAlpha(c.pal.accent, 0.16),
          color: c.pal.accent,
          letterSpacing: 2,
        }).nodes,
      );
      y += ch.h + 24;
    }

    const items = c.slide.items ?? (c.slide.bullets ?? []).map((b, i) => ({ label: b, value: String(i + 1) }));
    const zoneH = c.h - c.pad - 66 - y;
    if (items.length) {
      const rowH = Math.min(64, zoneH / items.length);
      const size = Math.max(17, Math.min(25, rowH * 0.42));
      const badge = Math.min(22, rowH * 0.36);
      items.slice(0, 12).forEach((it, i) => {
        const ry = y + i * rowH;
        const midY = ry + rowH / 2;
        nodes.push(
          ...D.numberBadge(c, i + 1, cb.x + badge, midY, badge, {
            fill: withAlpha(c.pal.accent, 0.16),
            color: c.pal.accent,
          }),
        );
        const lw = textWidth(c, it.label, c.fonts.sans, size, 600);
        const vw = textWidth(c, it.value, c.fonts.mono, size, 700) + 8;
        nodes.push(
          fixedBlock(c, it.label, {
            x: cb.x + badge * 2 + 16,
            y: midY - size * 0.66,
            w: cb.w - badge * 2 - vw - 30,
            size,
            font: c.fonts.sans,
            weight: 600,
            color: c.pal.fg,
            lineHeight: 1.1,
            marks: {},
          }).node,
        );
        // Leader dots between the label and the page number.
        const dotsX = cb.x + badge * 2 + 24 + lw;
        const dotsW = cb.w - (dotsX - cb.x) - vw - 8;
        if (dotsW > 20) {
          nodes.push({
            kind: "line",
            x1: dotsX,
            y1: midY + size * 0.2,
            x2: dotsX + dotsW,
            y2: midY + size * 0.2,
            stroke: withAlpha(c.pal.fg, 0.32),
            lineWidth: 1.5,
            dash: [2, 6],
            cap: "round",
          });
        }
        nodes.push(
          fixedBlock(c, it.value, {
            x: cb.x + cb.w - vw,
            y: midY - size * 0.66,
            w: vw,
            size,
            font: c.fonts.mono,
            weight: 700,
            color: c.pal.accent,
            align: "right",
            marks: {},
          }).node,
        );
      });
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 40 · Colour Pop -------------------------- */

export const colorpop: Preset = {
  id: "colorpop",
  name: "Colour Pop",
  category: "playful",
  blurb: "Every headline word in a different colour, doodles scattered around it.",
  defaultPalette: "notebook",
  palettes: ["notebook", "candy", "lavender", "cream", "slate"],
  needs: ["kicker", "body", "note"],
  brief:
    "A loud, friendly cover. Title 4–9 words — each word gets its own colour, so make every word count. `body` is one short supporting line.",
  slideRange: [6, 9],
  pad: 78,
  render(c) {
    const nodes: Node[] = [];
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.35), ruleStep: 54, margin: false }));
    const left = c.pad + 76;
    const cb = { x: left, y: c.pad, w: c.w - left - c.pad, h: c.h - c.pad * 2 };

    if (c.slide.kicker) {
      nodes.push(...P.tapeLabel(c, c.slide.kicker, cb.x, cb.y - 34, { angle: -0.05, size: 17 }));
    }

    // Colour-cycled headline: one hue per word.
    // Disciplined "colour pop": the palette's own two accents plus ink, not a
    // random rainbow. One coherent set, ink-anchored.
    const palette = [c.pal.accent, c.pal.fg, c.pal.accent2];
    const words = c.slide.title.split(/\s+/).filter(Boolean);
    const marked = words.map((w, i) => `{{${i % palette.length}}}${w}`).join(" ");
    // Render word by word so each can take its own colour.
    const probe = block(c, c.slide.title, {
      x: cb.x,
      y: 0,
      w: cb.w,
      maxH: cb.h * 0.52,
      font: c.fonts.sans,
      weight: 800,
      max: 118,
      min: 44,
      lineHeight: 1.02,
      align: "center",
      letterSpacing: -2,
      uppercase: true,
      marks: {},
    });
    const size = probe.size;
    const space = textWidth(c, " ", c.fonts.sans, size, 800);
    let wi = 0;
    let y = cb.y + (cb.h * 0.5 - probe.height) / 2 + 20;
    for (const line of probe.node.lines) {
      let x = cb.x + (cb.w - line.width) / 2;
      for (const tok of line.tokens) {
        const w = textWidth(c, tok.text, c.fonts.sans, size, 800, -2);
        nodes.push(
          fixedBlock(c, tok.text, {
            x,
            y,
            w: w + 12,
            size,
            font: c.fonts.sans,
            weight: 800,
            color: palette[wi % palette.length],
            letterSpacing: -2,
            lineHeight: 1.02,
            marks: {},
          }).node,
        );
        x += w + space;
        wi++;
      }
      y += size * 1.02;
    }
    y += 18;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x + cb.w * 0.08,
        y,
        w: cb.w * 0.84,
        size: 25,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.fg,
        align: "center",
        lineHeight: 1.25,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 20;
    }

    if (c.slide.note) {
      const ch = D.chip(c, c.slide.note, {
        x: 0,
        y: 0,
        size: 18,
        fill: c.pal.accent,
        color: "#ffffff",
        letterSpacing: 1,
        uppercase: false,
      });
      nodes.push(
        ...D.chip(c, c.slide.note, {
          x: (c.w - ch.w) / 2,
          y: c.h - c.pad - 20,
          size: 18,
          fill: c.pal.accent,
          color: "#ffffff",
          letterSpacing: 1,
          uppercase: false,
        }).nodes,
      );
    }
    return scene(c, c.pal.bg, nodes);
  },
};

/* -------------------------- 41 · Corporate Geo ------------------------- */

export const essay: Preset = {
  id: "essay",
  name: "Essay",
  category: "editorial",
  blurb: "A paragraph that earns its length, one clause bolded, a line drawing beneath.",
  defaultPalette: "paper",
  palettes: ["paper", "cream", "slate", "parchment"],
  needs: ["body", "note"],
  brief:
    "Long-form, for one idea per slide. `body` is 25–45 words of real prose — full sentences, not fragments — with **bold** on the single clause that carries the argument. Title is a short lead-in of 3–8 words.",
  slideRange: [6, 9],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const marks = {
      accent: { color: c.pal.fg, weight: 800 },
      highlight: { highlight: withAlpha(c.pal.accent, 0.22) },
      underline: { underline: c.pal.accent },
      strike: { strike: c.pal.muted, color: c.pal.muted },
    };

    let y = cb.y + 10;
    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.9,
      maxH: cb.h * 0.24,
      font: c.fonts.sans,
      weight: 700,
      max: 62,
      min: 30,
      lineHeight: 1.16,
      letterSpacing: -1,
      color: c.pal.muted,
      marks,
    });
    nodes.push(t.node);
    y += t.height + 26;

    if (c.slide.body) {
      const b = block(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.94,
        maxH: cb.h * 0.46,
        font: c.fonts.sans,
        weight: 500,
        max: 46,
        min: 24,
        lineHeight: 1.42,
        color: c.pal.fg,
        marks,
      });
      nodes.push(b.node);
      y += b.height + 30;
    }

    // Essay is a manifesto slide — the words carry it. No decorative figure;
    // negative space is the design.
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 60,
          w: cb.w * 0.5,
          size: 20,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          lineHeight: 1.3,
          marks: {},
        }).node,
      );
    }
    nodes.push(D.arrow(cb.x + cb.w - 70, c.h - c.pad + 8, 70, c.pal.fg, 2.5));
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 2,
        w: cb.w * 0.5,
        size: 17,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.muted,
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.04, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};
