import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { withAlpha } from "../theme";
import {
  bodyPart,
  defaultShell,
  featurePart,
  layoutParts,
  scene,
  stepsPart,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* ---------------------------- 16 · Schematic ---------------------------- */

export const schematic: Preset = {
  id: "schematic",
  name: "Schematic",
  category: "technical",
  blurb: "Parchment, fine grid, exploded labelled diagram and an icon flow footer.",
  defaultPalette: "parchment",
  palettes: ["parchment", "cream", "blueprint", "clay"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Systems voice — describe how a thing is built. Title 3–7 words in caps, with **accent** on the payoff word. `bullets` name the stages of the system (1–2 words each, 4–7 of them) and are drawn as the diagram's labelled nodes.",
  slideRange: [7, 10],
  pad: 82,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...P.gridPaper(c, withAlpha(c.pal.fg, 0.055), 45, 1));
    nodes.push(D.grain(c, 0.06, "#000000"));

    // Mono meta corners.
    const meta = (text: string, x: number, align: "left" | "right") =>
      fixedBlock(c, text, {
        x: align === "left" ? x : x - 320,
        y: cb.y - 26,
        w: 320,
        size: 18,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        align,
        letterSpacing: 1.5,
        uppercase: true,
        marks: {},
      }).node;
    nodes.push(
      meta(`${String(c.index + 1).padStart(2, "0")} / ${String(c.total).padStart(2, "0")}`, cb.x, "left"),
      meta(c.slide.kicker ?? c.deck.angle.slice(0, 42), cb.x + cb.w, "right"),
    );

    let y = cb.y + 20;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: c.slide.role === "cover" ? 108 : 84,
      font: c.fonts.condensed,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 0.96,
      letterSpacing: -1,
      uppercase: true,
      marks: {
        accent: { color: c.pal.accent, weight: 800 },
        highlight: { highlight: withAlpha(c.pal.accent, 0.3) },
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
        w: cb.w * 0.72,
        size: 24,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.5,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 34;
    }

    // Exploded diagram: labelled boxes on a grid, wired together.
    const stages = (c.slide.bullets ?? []).slice(0, 6);
    const footH = 150;
    const diagramH = c.h - c.pad - footH - y;
    if (stages.length && diagramH > 180) {
      const cols = stages.length <= 4 ? 2 : 3;
      const rowsN = Math.ceil(stages.length / cols);
      const gx = 26;
      const gy = 24;
      const bw = (cb.w - gx * (cols - 1)) / cols;
      // Fill the diagram zone rather than leaving dead space beneath it.
      const bh = Math.min(250, (diagramH - gy * (rowsN - 1)) / rowsN);
      const usedH = bh * rowsN + gy * (rowsN - 1);
      y += Math.max(0, (diagramH - usedH) / 2);
      const centres: [number, number][] = [];
      stages.forEach((label, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const bx = cb.x + col * (bw + gx);
        const by = y + row * (bh + gy);
        centres.push([bx + bw / 2, by + bh / 2]);
        nodes.push({
          kind: "rect",
          x: bx,
          y: by,
          w: bw,
          h: bh,
          r: 4,
          fill: withAlpha(c.pal.surface, 0.75),
          stroke: withAlpha(c.pal.fg, 0.42),
          lineWidth: 1.5,
        });
        nodes.push(
          fixedBlock(c, String(i + 1).padStart(2, "0"), {
            x: bx + 14,
            y: by + 12,
            w: 60,
            size: 17,
            font: c.fonts.mono,
            weight: 700,
            color: c.pal.accent,
            marks: {},
          }).node,
        );
        const g = P.icon(iconFor(label), bx + bw - 62, by + 16, 44, withAlpha(c.pal.fg, 0.65), { width: 2.5 });
        if (g) nodes.push(g);
        nodes.push(
          fixedBlock(c, label, {
            x: bx + 14,
            y: by + bh - 62,
            w: bw - 28,
            size: 22,
            font: c.fonts.condensed,
            weight: 700,
            color: c.pal.fg,
            lineHeight: 1.16,
            uppercase: true,
            letterSpacing: 0.5,
            marks: {},
          }).node,
        );
      });
      for (let i = 0; i < centres.length - 1; i++) {
        const [x1, y1] = centres[i];
        const [x2, y2] = centres[i + 1];
        nodes.push({
          kind: "line",
          x1,
          y1,
          x2,
          y2,
          stroke: withAlpha(c.pal.accent, 0.35),
          lineWidth: 1.5,
          dash: [6, 6],
        });
      }
    }

    // Icon flow footer.
    const fy = c.h - c.pad - footH + 44;
    const flow = stages.length ? stages.slice(0, 5) : [c.deck.topic, c.slide.title, c.deck.angle];
    const step = cb.w / flow.length;
    flow.forEach((label, i) => {
      const cx = cb.x + step * i + step / 2;
      const g = P.icon(iconFor(label), cx - 22, fy, 44, c.pal.fg, { width: 2.5 });
      if (g) nodes.push(g);
      nodes.push(
        fixedBlock(c, label, {
          x: cx - step / 2 + 8,
          y: fy + 56,
          w: step - 16,
          size: 15,
          font: c.fonts.mono,
          weight: 600,
          color: c.pal.muted,
          align: "center",
          uppercase: true,
          letterSpacing: 1,
          marks: {},
        }).node,
      );
      if (i < flow.length - 1) {
        nodes.push(D.arrow(cx + 30, fy + 22, step - 60, withAlpha(c.pal.fg, 0.4), 1.5));
      }
    });
    nodes.push(
      { kind: "line", x1: cb.x, y1: c.h - c.pad - 4, x2: cb.x + cb.w, y2: c.h - c.pad - 4, stroke: withAlpha(c.pal.fg, 0.3), lineWidth: 1 },
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 10,
        w: cb.w,
        size: 18,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        letterSpacing: 1.5,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 17 · Cheatsheet --------------------------- */

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
      size: c.slide.role === "cover" ? 88 : 62,
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
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.7), ruleStep: 50, margin: false }));

    // Handwritten page tab.
    nodes.push(
      fixedBlock(c, `Page ${c.index + 1}`, {
        x: cb.x,
        y: cb.y - 34,
        w: 240,
        size: 28,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent2,
        marks: {},
      }).node,
    );

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

    // Illustration column on the right.
    const colW = 132;
    const listW = cb.w - colW - 26;
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

    // Stacked illustrations down the right edge.
    const iconCount = Math.max(3, Math.min(5, Math.ceil(items.length / 2)));
    for (let i = 0; i < iconCount; i++) {
      const seed = items[i * 2] ?? `${c.slide.title}-${i}`;
      const ix = cb.x + cb.w - colW + 18;
      const iy = y + 10 + (avail / iconCount) * i + 6;
      const tile = P.iconTile(c, iconFor(seed), ix, iy, 92, {
        fill: withAlpha(i % 2 ? c.pal.accent2 : c.pal.accent, 0.14),
        color: i % 2 ? c.pal.accent2 : c.pal.accent,
        radius: 22,
      });
      nodes.push(...tile.map((n) => ({ ...n, rotate: (i % 2 ? 1 : -1) * 0.06, origin: [ix + 46, iy + 46] as [number, number] })));
    }

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

export const flowchart: Preset = {
  id: "flowchart",
  name: "Flowchart",
  category: "technical",
  blurb: "Colour-coded headline, a big vector figure, arrows fanning out to cards.",
  defaultPalette: "slate",
  palettes: ["slate", "clay", "notebook", "parchment"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Show a system fanning out. Title 4–9 words with **accent** and ==highlight== marking two different keywords so they read in different colours. `bullets` become the branch cards — 3–5 of them, 2–7 words each.",
  slideRange: [7, 9],
  pad: 82,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.035, "#000000"));

    // Author chip top-right.
    nodes.push(
      fixedBlock(c, `${String(c.index + 1).padStart(2, "0")}`, {
        x: cb.x,
        y: cb.y - 24,
        w: 90,
        size: 20,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        marks: {},
      }).node,
    );
    const handle = c.deck.handle || "@you";
    const hw = textWidth(c, handle, c.fonts.sans, 21, 600);
    nodes.push(
      ...D.avatar(c, handle, cb.x + cb.w - hw - 40, cb.y - 12, 17, { fill: c.pal.accent }),
      fixedBlock(c, handle, {
        x: cb.x + cb.w - hw,
        y: cb.y - 24,
        w: hw + 6,
        size: 21,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.fg,
        marks: {},
      }).node,
    );

    let y = cb.y + 30;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.92,
      size: c.slide.role === "cover" ? 92 : 74,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.fg,
      lineHeight: 1.06,
      letterSpacing: -2,
      uppercase: true,
      marks: {
        accent: { color: c.pal.accent2, weight: 800 },
        highlight: { color: c.pal.accent, weight: 800 },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    y += t.height + 18;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.8,
        size: 25,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.4,
        marks: {
          accent: { color: c.pal.fg, weight: 700 },
          highlight: { highlight: withAlpha(c.pal.accent, 0.22) },
          underline: { underline: c.pal.accent },
          strike: { strike: c.pal.muted, color: c.pal.muted },
        },
      });
      nodes.push(b.node);
      y += b.height + 40;
    }

    // Source node on the left, branch cards on the right.
    const branches = (c.slide.bullets ?? []).slice(0, 5);
    const zoneH = c.h - c.pad - 70 - y;
    const srcSize = Math.min(200, zoneH * 0.5);
    const srcX = cb.x + srcSize * 0.5;
    const srcY = y + zoneH / 2;
    nodes.push({
      kind: "rect",
      x: srcX - srcSize / 2,
      y: srcY - srcSize / 2,
      w: srcSize,
      h: srcSize,
      r: 26,
      fill: withAlpha(c.pal.accent, 0.16),
    });
    const fig = P.icon(iconFor(c.deck.topic), srcX - srcSize * 0.3, srcY - srcSize * 0.3, srcSize * 0.6, c.pal.accent, {
      width: srcSize * 0.045,
    });
    if (fig) nodes.push(fig);

    if (branches.length) {
      const cardX = cb.x + cb.w * 0.42;
      const cardW = cb.w - (cardX - cb.x);
      const gap = 14;
      const cardH = Math.min(96, (zoneH - gap * (branches.length - 1)) / branches.length);
      branches.forEach((label, i) => {
        const cy2 = y + i * (cardH + gap);
        nodes.push(D.card(c, cardX, cy2, cardW, cardH, { fill: c.pal.surface, radius: 16, shadow: false, stroke: c.pal.line }));
        const g = P.icon(iconFor(label), cardX + 18, cy2 + cardH / 2 - 17, 34, c.pal.accent2, { width: 2.5 });
        if (g) nodes.push(g);
        nodes.push(
          fixedBlock(c, label, {
            x: cardX + 66,
            y: cy2 + cardH / 2 - 15,
            w: cardW - 180,
            size: 23,
            font: c.fonts.sans,
            weight: 600,
            color: c.pal.fg,
            lineHeight: 1.2,
            marks: {},
          }).node,
        );
        const btn = D.chip(c, "Open", {
          x: cardX + cardW - 106,
          y: cy2 + cardH / 2 - 18,
          size: 17,
          fill: c.pal.accent,
          color: "#ffffff",
          letterSpacing: 0.5,
          uppercase: false,
        });
        nodes.push(...btn.nodes);
        nodes.push(
          ...D.curvedArrow(
            [srcX + srcSize / 2 + 8, srcY],
            [cardX - 12, cy2 + cardH / 2],
            (i - (branches.length - 1) / 2) * -18,
            withAlpha(c.pal.fg, 0.35),
            2,
          ),
        );
      });
    }

    nodes.push(
      fixedBlock(c, (c.slide.note ?? c.deck.angle).toUpperCase(), {
        x: cb.x,
        y: c.h - c.pad + 4,
        w: cb.w * 0.7,
        size: 17,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        letterSpacing: 1.5,
        marks: {},
      }).node,
    );
    nodes.push(D.arrow(cb.x + cb.w - 150, c.h - c.pad + 14, 150, withAlpha(c.pal.fg, 0.45), 2));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 20 · Timeline ---------------------------- */

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
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.dotGrid(c, 60, 2, withAlpha(c.pal.fg, 0.07)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: c.slide.role === "cover" ? 100 : 70,
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
