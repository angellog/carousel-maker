import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyPart,
  coverScene,
  defaultShell,
  featurePart,
  layoutParts,
  scene,
  stepsPart,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* ---------------------------- 16 · Schematic ---------------------------- */

export const cheatsheet: Preset = {
  id: "cheatsheet",
  name: "Cheatsheet",
  category: "technical",
  blurb: "Reference card: an author chip, section rules, and key → meaning rows.",
  defaultPalette: "slate",
  palettes: ["slate", "ink", "notebook", "terminal"],
  needs: ["kicker", "items", "note"],
  brief:
    "Pure reference. Every body slide is a section: `title` names it, and `items` holds 5–8 rows where `label` is the thing to remember (a shortcut, term, or command — keep it under 24 characters) and `value` is the short gloss.",
  slideRange: [8, 10],
  pad: 78,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];

    // Author chip.
    const handle = c.deck.handle || "@you";
    nodes.push(...D.avatar(c, handle, cb.x + 22, cb.y + 4, 22, { fill: c.pal.accent }));
    nodes.push(
      fixedBlock(c, handle, {
        x: cb.x + 54,
        y: cb.y - 9,
        w: cb.w * 0.5,
        size: 22,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.muted,
        marks: {},
      }).node,
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x + cb.w - 120,
        y: cb.y - 9,
        w: 120,
        size: 22,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        align: "right",
        marks: {},
      }).node,
    );

    let y = cb.y + 66;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: 62,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.06,
      letterSpacing: -1.6,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: withAlpha(c.pal.accent, 0.22) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 14;
    nodes.push({ kind: "line", x1: cb.x, y1: y, x2: cb.x + cb.w, y2: y, stroke: c.pal.line, lineWidth: 2 });
    y += 30;

    if (c.slide.kicker) {
      const k = fixedBlock(c, c.slide.kicker, {
        x: cb.x,
        y,
        w: cb.w,
        size: 24,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.accent,
        letterSpacing: 2,
        uppercase: true,
        marks: {},
      });
      nodes.push(k.node);
      y += k.height + 22;
    }

    const items = c.slide.items ?? (c.slide.bullets ?? []).map((b) => {
      const [label, ...rest] = b.split(/\s+[—–-]\s+/);
      return { label, value: rest.join(" — ") || "" };
    });
    const footH = c.slide.note ? 108 : 66;
    const avail = c.h - c.pad - footH - y;
    if (items.length) {
      const rowH = Math.min(84, avail / items.length);
      const keySize = Math.max(20, Math.min(27, rowH * 0.36));
      items.forEach((it, i) => {
        const ry = y + i * rowH;
        const keyW = textWidth(c, it.label, c.fonts.mono, keySize, 700) + 30;
        nodes.push({
          kind: "rect",
          x: cb.x,
          y: ry,
          w: Math.min(keyW, cb.w * 0.46),
          h: rowH * 0.72,
          r: 8,
          fill: withAlpha(c.pal.accent, 0.1),
          stroke: withAlpha(c.pal.accent, 0.3),
          lineWidth: 1.5,
        });
        nodes.push(
          fixedBlock(c, it.label, {
            x: cb.x + 15,
            y: ry + rowH * 0.72 / 2 - keySize * 0.62,
            w: cb.w * 0.46,
            size: keySize,
            font: c.fonts.mono,
            weight: 700,
            color: c.pal.accent,
            marks: {},
          }).node,
        );
        if (it.value) {
          const vx = cb.x + Math.min(keyW, cb.w * 0.46) + 22;
          nodes.push(D.arrow(vx, ry + rowH * 0.36, 26, c.pal.muted, 2));
          nodes.push(
            fixedBlock(c, it.value, {
              x: vx + 38,
              y: ry + rowH * 0.36 - keySize * 0.62,
              w: cb.x + cb.w - vx - 38,
              size: keySize,
              font: c.fonts.sans,
              weight: 500,
              color: c.pal.fg,
              lineHeight: 1.2,
              marks: {},
            }).node,
          );
        }
      });
    }

    if (c.slide.note) {
      nodes.push(
        {
          kind: "rect",
          x: cb.x,
          y: c.h - c.pad - 96,
          w: cb.w,
          h: 62,
          r: 10,
          fill: withAlpha(c.pal.accent2, 0.12),
        },
        fixedBlock(c, c.slide.note, {
          x: cb.x + 20,
          y: c.h - c.pad - 78,
          w: cb.w - 40,
          size: 23,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.progressBar(c, c.h - 5, 5));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 18 · Number List -------------------------- */

export const numberlist: Preset = {
  id: "numberlist",
  name: "Number List",
  category: "editorial",
  blurb: "Bordered section bar, square number badges and an illustration column.",
  defaultPalette: "notebook",
  palettes: ["notebook", "slate", "cream", "lavender"],
  needs: ["kicker", "bullets", "note"],
  brief:
    "The saveable list. `title` names the section, `bullets` are the numbered entries — 6–10 words each, written as instructions. Wrap any variable the reader must swap in square brackets, e.g. `Explain [topic] like I'm 10`.",
  slideRange: [8, 10],
  pad: 74,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.3), ruleStep: 50, margin: false }));

    // Bordered section title bar.
    let y = cb.y + 6;
    const barH = 76;
    nodes.push({
      kind: "rect",
      x: cb.x,
      y,
      w: cb.w,
      h: barH,
      r: 14,
      fill: c.pal.surface,
      stroke: c.pal.accent,
      lineWidth: 2.5,
    });
    const g = P.icon(iconFor(c.slide.title), cb.x + 22, y + 18, 40, c.pal.accent, { width: 3 });
    if (g) nodes.push(g);
    nodes.push(
      fixedBlock(c, c.slide.title, {
        x: cb.x + 78,
        y: y + barH / 2 - 19,
        w: cb.w - 100,
        size: 32,
        font: c.fonts.sans,
        weight: 800,
        color: c.pal.fg,
        letterSpacing: 0.5,
        uppercase: true,
        lineHeight: 1.1,
        marks: { accent: { color: c.pal.accent, weight: 800 } },
      }).node,
    );
    y += barH + 26;

    // The list runs full width — no decorative icon column.
    const colW = 0;
    const listW = cb.w - colW;
    const items = (c.slide.bullets ?? []).slice(0, 10);
    const footH = c.slide.note ? 96 : 56;
    const avail = c.h - c.pad - footH - y;
    const rowH = items.length ? Math.min(72, avail / items.length) : 0;
    const badge = Math.min(38, rowH * 0.62);
    const textSize = Math.max(19, Math.min(26, rowH * 0.36));

    items.forEach((text, i) => {
      const ry = y + i * rowH;
      nodes.push({
        kind: "rect",
        x: cb.x,
        y: ry,
        w: badge,
        h: badge,
        r: 9,
        fill: c.pal.accent,
      });
      nodes.push(
        fixedBlock(c, String(i + 1), {
          x: cb.x,
          y: ry + badge / 2 - textSize * 0.6,
          w: badge,
          size: textSize,
          font: c.fonts.sans,
          weight: 800,
          color: "#ffffff",
          align: "center",
          marks: {},
        }).node,
      );
      // Highlight [bracketed] variables.
      const marked = text.replace(/\[([^\]]+)\]/g, "==[$1]==");
      nodes.push(
        fixedBlock(c, marked, {
          x: cb.x + badge + 18,
          y: ry + badge / 2 - textSize * 0.66,
          w: listW - badge - 18,
          size: textSize,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.fg,
          lineHeight: 1.2,
          marks: {
            accent: { color: c.pal.accent, weight: 700 },
            highlight: { highlight: withAlpha(c.pal.accent2, 0.25), color: c.pal.accent2, weight: 700 },
            underline: { underline: c.pal.accent },
            strike: { strike: c.pal.muted, color: c.pal.muted },
          },
        }).node,
      );
    });

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 84,
          w: cb.w,
          size: 24,
          font: c.fonts.hand,
          weight: 700,
          color: c.pal.accent2,
          align: "center",
          marks: {},
        }).node,
      );
    }
    const ch = D.chip(c, c.deck.handle || "@you", {
      x: 0,
      y: 0,
      size: 20,
      fill: c.pal.accent,
      color: "#ffffff",
      letterSpacing: 1,
      uppercase: false,
    });
    nodes.push(
      ...D.chip(c, c.deck.handle || "@you", {
        x: (c.w - ch.w) / 2,
        y: c.h - c.pad - 6,
        size: 20,
        fill: c.pal.accent,
        color: "#ffffff",
        letterSpacing: 1,
        uppercase: false,
      }).nodes,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 19 · Flowchart --------------------------- */

export const timeline: Preset = {
  id: "timeline",
  name: "Timeline",
  category: "editorial",
  blurb: "A vertical spine with numbered stops — for roadmaps and before/after arcs.",
  defaultPalette: "midnight",
  palettes: ["midnight", "slate", "forest", "cream", "blueprint"],
  needs: ["kicker", "body", "steps", "note"],
  brief:
    "Sequential narrative. Every body slide carries `steps`: 3–5 stages, each with a short `label` (2–5 words) and a `text` of one clause. The order must read as a progression.",
  slideRange: [7, 9],
  pad: 92,
  render(c) {
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.dotGrid(c, 60, 2, withAlpha(c.pal.fg, 0.07)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: 70,
      titleMin: 36,
      titleLH: 1.06,
      titleLS: -2,
      bodySize: 27,
      bodyLH: 1.42,
      kickerSize: 21,
      kickerLS: 3,
      gap: 24,
    });
    const box = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - 74 };
    const head = [titlePart(c, s, box, undefined, box.h * 0.3), bodyPart(c, s, box)];
    let y = box.y;
    for (const part of head) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 14;

    const steps = stepsPart(c, s, { ...box, y, h: box.h - (y - box.y) });
    if (steps) {
      nodes.push(...steps.draw(y));
    } else {
      const f = featurePart(c, s, { ...box, y, h: box.h - (y - box.y) });
      if (f) nodes.push(...f.draw(y));
    }

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 58,
          w: cb.w,
          size: 22,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    nodes.push(...D.progressBar(c, c.h - 5, 5));
    return scene(c, c.pal.bg, nodes);
  },
};
