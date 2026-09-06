import type { Ctx } from "../render/ctx";
import { block, contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as G from "../render/diagrams";
import { iconFor } from "../render/icons";
import * as P from "../render/props";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import type { SlidePanel } from "../types";
import { defaultShell, headStack, scene } from "./_shared";
import type { Preset } from "./types";

function panelsOf(c: Ctx): SlidePanel[] {
  if (c.slide.panels?.length) return c.slide.panels;
  const b = c.slide.bullets ?? [];
  if (b.length >= 4) {
    const half = Math.ceil(b.length / 2);
    return [
      { title: "Inside", items: b.slice(0, half) },
      { title: "Also", items: b.slice(half) },
    ];
  }
  return b.length ? [{ title: "Inside", items: b }] : [];
}

/* ----------------------------- 36 · Dossier ---------------------------- */

export const dossier: Preset = {
  id: "dossier",
  name: "Dossier",
  category: "editorial",
  blurb: "Vintage rules, a subject at the centre, numbered panels all around it.",
  defaultPalette: "parchment",
  palettes: ["parchment", "cream", "paper", "clay"],
  needs: ["kicker", "body", "panels", "note"],
  brief:
    "A profile of one subject — a person, tool, company or idea. The title is the subject's name. `kicker` is the one-line descriptor. `panels` are 4 aspects of it, each with 2–4 short facts.",
  slideRange: [6, 9],
  pad: 68,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.07, "#000000"));
    // Double rule frame.
    const inset = 22;
    nodes.push(
      { kind: "rect", x: inset, y: inset, w: c.w - inset * 2, h: c.h - inset * 2, stroke: withAlpha(c.pal.fg, 0.55), lineWidth: 2.5 },
      { kind: "rect", x: inset + 8, y: inset + 8, w: c.w - (inset + 8) * 2, h: c.h - (inset + 8) * 2, stroke: withAlpha(c.pal.fg, 0.3), lineWidth: 1 },
    );

    let y = cb.y + 10;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: 78,
      font: c.fonts.serif,
      weight: 700,
      color: c.pal.fg,
      align: "center",
      lineHeight: 1.04,
      letterSpacing: 2,
      uppercase: true,
      marks: {},
    });
    nodes.push(t.node);
    y += t.height + 10;
    if (c.slide.kicker) {
      nodes.push(
        fixedBlock(c, c.slide.kicker, {
          x: cb.x,
          y,
          w: cb.w,
          size: 20,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          align: "center",
          letterSpacing: 3,
          uppercase: true,
          marks: {},
        }).node,
      );
      y += 32;
    }
    nodes.push({ kind: "line", x1: cb.x + 40, y1: y, x2: cb.x + cb.w - 40, y2: y, stroke: withAlpha(c.pal.fg, 0.45), lineWidth: 1.5 });
    y += 22;

    // Centre emblem between the panel columns.
    const list = panelsOf(c).slice(0, 4);
    const noteH = c.slide.note ? 84 : 46;
    const zoneH = c.h - c.pad - noteH - y;
    const emblem = Math.min(180, zoneH * 0.4);
    const cx = c.w / 2;
    const cy = y + zoneH / 2;
    nodes.push({ kind: "ellipse", cx, cy, rx: emblem / 2, ry: emblem / 2, stroke: withAlpha(c.pal.fg, 0.4), lineWidth: 2, fill: withAlpha(c.pal.accent, 0.08) });
    const g = P.icon(iconFor(c.slide.title), cx - emblem * 0.26, cy - emblem * 0.26, emblem * 0.52, c.pal.fg, { width: 3 });
    if (g) nodes.push(g);

    if (list.length) {
      const colW = (cb.w - emblem - 44) / 2;
      const perCol = Math.ceil(list.length / 2);
      list.forEach((panel, i) => {
        const left = i < perCol;
        const x = left ? cb.x : cb.x + cb.w - colW;
        const idx = left ? i : i - perCol;
        const h = Math.min((zoneH - 16 * (perCol - 1)) / perCol, G.naturalPanelHeight(list, 120));
        const py = y + Math.max(0, (zoneH - (h * perCol + 16 * (perCol - 1))) / 2) + idx * (h + 16);
        nodes.push({ kind: "rect", x, y: py, w: colW, h, stroke: withAlpha(c.pal.fg, 0.4), lineWidth: 1.5 });
        nodes.push(
          fixedBlock(c, `${i + 1}. ${panel.title}`, {
            x: x + 12,
            y: py + 10,
            w: colW - 24,
            size: 17,
            font: c.fonts.sans,
            weight: 800,
            color: c.pal.accent,
            uppercase: true,
            letterSpacing: 1,
            lineHeight: 1.1,
            marks: {},
          }).node,
        );
        let iy = py + 36;
        for (const item of panel.items.slice(0, 4)) {
          const b = fixedBlock(c, item, {
            x: x + 12,
            y: iy,
            w: colW - 24,
            size: 15,
            font: c.fonts.serif,
            weight: 400,
            color: c.pal.fg,
            lineHeight: 1.24,
            marks: {},
          });
          if (iy + b.height > py + h - 6) break;
          nodes.push(b.node);
          iy += b.height + 6;
        }
      });
    }

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, `“${c.slide.note}”`, {
          x: cb.x,
          y: c.h - c.pad - 62,
          w: cb.w,
          size: 21,
          font: c.fonts.serif,
          weight: 400,
          italic: true,
          color: c.pal.fg,
          align: "center",
          marks: {},
        }).node,
      );
    }
    nodes.push(
      fixedBlock(c, `${c.deck.handle || ""}   ·   ${c.index + 1} / ${c.total}`, {
        x: cb.x,
        y: c.h - c.pad + 2,
        w: cb.w,
        size: 15,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        align: "center",
        letterSpacing: 2,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 37 · Study Sheet -------------------------- */

export const studysheet: Preset = {
  id: "studysheet",
  name: "Study Sheet",
  category: "playful",
  blurb: "Ruled page, a figure in the middle, numbered panels around it, closing question.",
  defaultPalette: "notebook",
  palettes: ["notebook", "cream", "lavender", "paper"],
  needs: ["kicker", "body", "panels", "note"],
  brief:
    "Revision-sheet voice. `panels` are 4 numbered sections (`title` 1–3 words like 'Overview', 'Key facts'), each with 2–4 short factual lines. `note` is the closing 'Think about this' question.",
  slideRange: [7, 10],
  pad: 70,
  render(c) {
    const nodes: Node[] = [];
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.65), ruleStep: 50, spiral: true, margin: false }));
    const left = c.pad + 82;
    const cb = { x: left, y: c.pad, w: c.w - left - c.pad, h: c.h - c.pad * 2 };

    let y = cb.y;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      size: 62,
      font: c.fonts.hand,
      weight: 700,
      color: c.pal.fg,
      align: "center",
      lineHeight: 1.06,
      marks: { accent: { color: c.pal.accent, weight: 700 } },
    });
    nodes.push(t.node);
    y += t.height + 8;
    nodes.push(...D.sketchUnderline(c, cb.x + cb.w * 0.2, y, cb.w * 0.6, withAlpha(c.pal.accent, 0.6), 5));
    y += 28;

    const noteH = c.slide.note ? 96 : 44;
    const zoneH = c.h - c.pad - noteH - y;
    const list = panelsOf(c).slice(0, 4);

    // Central figure, panels flanking it.
    const figS = Math.min(200, zoneH * 0.42);
    const g = P.icon(iconFor(c.slide.title), c.w / 2 - figS / 2, y + zoneH / 2 - figS / 2, figS, withAlpha(c.pal.accent, 0.35), { width: 5 });
    if (g) nodes.push(g);

    if (list.length) {
      const colW = (cb.w - figS - 36) / 2;
      const perCol = Math.ceil(list.length / 2);
      const h = Math.min((zoneH - 14 * (perCol - 1)) / perCol, G.naturalPanelHeight(list, 130));
      const colTop = y + Math.max(0, (zoneH - (h * perCol + 14 * (perCol - 1))) / 2);
      list.forEach((panel, i) => {
        const leftCol = i < perCol;
        const x = leftCol ? cb.x : cb.x + cb.w - colW;
        const idx = leftCol ? i : i - perCol;
        const py = colTop + idx * (h + 14);
        nodes.push({
          kind: "rect",
          x,
          y: py,
          w: colW,
          h,
          r: 12,
          fill: withAlpha(c.pal.surface, 0.85),
          stroke: withAlpha(c.pal.accent, 0.5),
          lineWidth: 2,
        });
        nodes.push(
          fixedBlock(c, `${i + 1}. ${panel.title}`, {
            x: x + 12,
            y: py + 9,
            w: colW - 24,
            size: 18,
            font: c.fonts.hand,
            weight: 700,
            color: c.pal.accent,
            lineHeight: 1.1,
            marks: {},
          }).node,
        );
        let iy = py + 36;
        for (const item of panel.items.slice(0, 4)) {
          const b = fixedBlock(c, item, {
            x: x + 22,
            y: iy,
            w: colW - 34,
            size: 16,
            font: c.fonts.hand,
            weight: 600,
            color: c.pal.fg,
            lineHeight: 1.22,
            marks: {},
          });
          if (iy + b.height > py + h - 6) break;
          nodes.push(
            { kind: "ellipse", cx: x + 13, cy: iy + 9, rx: 3, ry: 3, fill: c.pal.accent2 },
            b.node,
          );
          iy += b.height + 6;
        }
      });
    }

    if (c.slide.note) {
      const ny = c.h - c.pad - 76;
      nodes.push(
        { kind: "rect", x: cb.x, y: ny, w: cb.w, h: 58, r: 14, stroke: c.pal.accent2, lineWidth: 2, dash: [8, 6] },
        fixedBlock(c, c.slide.note, {
          x: cb.x + 18,
          y: ny + 16,
          w: cb.w - 36,
          size: 21,
          font: c.fonts.hand,
          weight: 700,
          color: c.pal.fg,
          align: "center",
          marks: {},
        }).node,
      );
    }
    nodes.push(
      { kind: "ellipse", cx: c.w / 2, cy: c.h - c.pad + 12, rx: 20, ry: 20, stroke: c.pal.accent, lineWidth: 2.5 },
      fixedBlock(c, String(c.index + 1), {
        x: c.w / 2 - 20,
        y: c.h - c.pad + 0,
        w: 40,
        size: 22,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent,
        align: "center",
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 38 · Index Cover -------------------------- */

export const indexcover: Preset = {
  id: "indexcover",
  name: "Index Cover",
  category: "playful",
  blurb: "Handbook cover: big title, preview chips, what's-inside and by-the-numbers.",
  defaultPalette: "notebook",
  palettes: ["notebook", "cream", "chalk", "slate"],
  needs: ["kicker", "body", "bullets", "panels", "stat", "note"],
  brief:
    "This is the cover of a guide. Title names the guide in 2–5 words; `kicker` is a version or category chip. `bullets` are 4–5 preview topics (1–2 words each). `panels` are 2 groups — what's inside, and who it's for.",
  slideRange: [7, 10],
  pad: 68,
  render(c) {
    const nodes: Node[] = [];
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.55), ruleStep: 52, spiral: true, margin: false }));
    const left = c.pad + 78;
    const cb = { x: left, y: c.pad, w: c.w - left - c.pad, h: c.h - c.pad * 2 };

    let y = cb.y - 6;
    if (c.slide.kicker) {
      const ch = D.chip(c, c.slide.kicker, {
        x: cb.x + cb.w - 240,
        y,
        size: 17,
        fill: c.pal.accent,
        color: "#ffffff",
        letterSpacing: 1.5,
      });
      nodes.push(...ch.nodes);
    }
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: y + 6,
        w: cb.w * 0.5,
        size: 17,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.muted,
        marks: {},
      }).node,
    );
    y += 42;

    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      maxH: cb.h * 0.3,
      font: c.fonts.sans,
      weight: 800,
      max: 104,
      min: 42,
      lineHeight: 1.0,
      align: "center",
      letterSpacing: -2,
      uppercase: true,
      marks: { accent: { color: c.pal.accent, weight: 800 } },
    });
    nodes.push(t.node);
    y += t.height + 10;
    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w,
        size: 23,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent2,
        align: "center",
        lineHeight: 1.2,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 16;
    }

    // Preview chips.
    const previews = (c.slide.bullets ?? []).slice(0, 5);
    if (previews.length) {
      const step = cb.w / previews.length;
      const tile = Math.min(step * 0.78, 96);
      previews.forEach((label, i) => {
        const x = cb.x + step * i + (step - tile) / 2;
        nodes.push(
          ...P.iconTile(c, iconFor(label), x, y, tile, {
            fill: withAlpha(i % 2 ? c.pal.accent2 : c.pal.accent, 0.14),
            color: i % 2 ? c.pal.accent2 : c.pal.accent,
            radius: 18,
          }),
        );
        nodes.push(
          fixedBlock(c, label, {
            x: cb.x + step * i + 4,
            y: y + tile + 8,
            w: step - 8,
            size: 15,
            font: c.fonts.sans,
            weight: 700,
            color: c.pal.fg,
            align: "center",
            lineHeight: 1.1,
            uppercase: true,
            marks: {},
          }).node,
        );
      });
      y += tile + 44;
    }

    // Footer panels + optional stat.
    const list = panelsOf(c).slice(0, 2);
    const zoneH = c.h - c.pad - 52 - y;
    if (zoneH > 110) {
      if (c.slide.stat) {
        const statW = cb.w * 0.28;
        const panelH = list.length ? Math.min(zoneH, G.naturalPanelHeight(list)) : zoneH;
        nodes.push({ kind: "rect", x: cb.x + cb.w - statW, y, w: statW, h: panelH, r: 14, fill: withAlpha(c.pal.accent, 0.12) });
        nodes.push(
          fixedBlock(c, c.slide.stat.value, {
            x: cb.x + cb.w - statW,
            y: y + panelH / 2 - 44,
            w: statW,
            size: 52,
            font: c.fonts.sans,
            weight: 800,
            color: c.pal.accent,
            align: "center",
            letterSpacing: -2,
            marks: {},
          }).node,
          fixedBlock(c, c.slide.stat.label, {
            x: cb.x + cb.w - statW + 10,
            y: y + panelH / 2 + 12,
            w: statW - 20,
            size: 15,
            font: c.fonts.sans,
            weight: 600,
            color: c.pal.muted,
            align: "center",
            lineHeight: 1.15,
            marks: {},
          }).node,
        );
        if (list.length) {
          nodes.push(...G.panelGrid(c, { x: cb.x, y, w: cb.w - statW - 16, h: panelH }, list, { cols: list.length }));
        }
      } else if (list.length) {
        nodes.push(...G.panelGrid(c, { x: cb.x, y, w: cb.w, h: zoneH }, list, { cols: list.length }));
      }
    }
    nodes.push(
      fixedBlock(c, c.slide.note ?? "Save this for later", {
        x: cb.x,
        y: c.h - c.pad + 6,
        w: cb.w,
        size: 19,
        font: c.fonts.hand,
        weight: 700,
        color: c.pal.accent,
        align: "center",
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 39 · Contents ---------------------------- */

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
    nodes.push(...P.ruledPage(c, { paper: c.pal.bg, rule: withAlpha(c.pal.line, 0.45), ruleStep: 54, spiral: true, margin: false }));
    const left = c.pad + 76;
    const cb = { x: left, y: c.pad, w: c.w - left - c.pad, h: c.h - c.pad * 2 };

    if (c.slide.kicker) {
      nodes.push(...P.tapeLabel(c, c.slide.kicker, cb.x, cb.y - 34, { angle: -0.05, size: 17 }));
    }

    // Colour-cycled headline: one hue per word.
    const palette = [c.pal.accent, c.pal.accent2, mix(c.pal.accent, "#7c3aed", 0.6), mix(c.pal.accent2, "#f59e0b", 0.5), c.pal.fg];
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

    // Doodle scatter around the type, avoiding the headline band.
    const seeds = [c.deck.topic, c.slide.title, c.slide.body ?? "idea", c.slide.note ?? "time", c.deck.angle, "star"];
    seeds.forEach((seed, i) => {
      const angle = (i / seeds.length) * Math.PI * 2 + 0.5;
      const rx = cb.w * 0.44;
      const ry = cb.h * 0.36;
      const dx = c.w / 2 + Math.cos(angle) * rx;
      const dy = cb.y + cb.h / 2 + Math.sin(angle) * ry;
      const g = P.icon(iconFor(seed), dx - 30, dy - 30, 60, palette[i % palette.length], { width: 3.5, opacity: 0.75 });
      if (g) nodes.push({ ...g, rotate: (c.rand() - 0.5) * 0.5, origin: [dx, dy] });
    });
    nodes.push(...P.sparkleField(c, withAlpha(c.pal.accent2, 0.6), 5, { min: 10, max: 20 }));

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

export const corpgeo: Preset = {
  id: "corpgeo",
  name: "Corporate Geo",
  category: "minimal",
  blurb: "White and red, a huge numeral, quarter-circles and dot grids.",
  defaultPalette: "ink",
  palettes: ["ink", "slate", "candy", "midnight"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Clean, corporate, confident. Title 4–8 words in caps. `kicker` is a short qualifier line (a region, a timeframe, a category).",
  slideRange: [6, 9],
  pad: 84,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];

    // Geometric furniture: quarter-circles bleeding off the right edge.
    nodes.push({
      kind: "path",
      d: `M ${c.w} ${c.h * 0.1} A ${c.w * 0.34} ${c.w * 0.34} 0 0 1 ${c.w} ${c.h * 0.1 + c.w * 0.68} Z`,
      fill: withAlpha(c.pal.accent, 0.9),
    });
    nodes.push({
      kind: "path",
      d: `M ${c.w * 0.62} ${c.h} A ${c.w * 0.2} ${c.w * 0.2} 0 0 1 ${c.w * 0.62 + c.w * 0.4} ${c.h} Z`,
      fill: withAlpha(c.pal.accent, 0.35),
    });
    for (const [gx, gy] of [
      [cb.x, c.h * 0.62],
      [c.w * 0.34, c.h * 0.09],
      [cb.x, c.h * 0.86],
    ] as [number, number][]) {
      for (let r = 0; r < 5; r++)
        for (let k = 0; k < 5; k++)
          nodes.push({ kind: "ellipse", cx: gx + k * 11, cy: gy + r * 11, rx: 2, ry: 2, fill: withAlpha(c.pal.fg, 0.28) });
    }

    let y = cb.y + 20;
    const numeral = c.slide.role === "cover" ? String(c.total - 2) : String(c.index);
    const n = fixedBlock(c, numeral, {
      x: cb.x,
      y,
      w: 260,
      size: 132,
      font: c.fonts.sans,
      weight: 800,
      color: c.pal.accent,
      letterSpacing: -6,
      lineHeight: 1,
      marks: {},
    });
    nodes.push(n.node);
    y += n.height + 6;

    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.78,
      maxH: cb.h * 0.34,
      font: c.fonts.sans,
      weight: 800,
      max: 84,
      min: 34,
      lineHeight: 1.04,
      letterSpacing: -1.5,
      uppercase: true,
      marks: { accent: { color: c.pal.accent, weight: 800 } },
    });
    nodes.push(t.node);
    y += t.height + 18;

    if (c.slide.kicker) {
      nodes.push(
        fixedBlock(c, c.slide.kicker, {
          x: cb.x,
          y,
          w: cb.w * 0.7,
          size: 20,
          font: c.fonts.sans,
          weight: 700,
          color: c.pal.muted,
          letterSpacing: 4,
          uppercase: true,
          marks: {},
        }).node,
      );
      y += 40;
    }
    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.62,
        size: 24,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.fg,
        lineHeight: 1.42,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 22;
    }
    for (const item of (c.slide.bullets ?? []).slice(0, 4)) {
      const b = fixedBlock(c, item, {
        x: cb.x + 26,
        y,
        w: cb.w * 0.58,
        size: 21,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.fg,
        lineHeight: 1.24,
        marks: {},
      });
      if (y + b.height > c.h - c.pad - 40) break;
      nodes.push({ kind: "rect", x: cb.x, y: y + 6, w: 12, h: 12, fill: c.pal.accent }, b.node);
      y += b.height + 16;
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 42 · Note Card --------------------------- */

export const notecard: Preset = {
  id: "notecard",
  name: "Note Card",
  category: "editorial",
  blurb: "Serif headline, a rotated handwritten card, then labelled how-to sections.",
  defaultPalette: "cream",
  palettes: ["cream", "paper", "clay", "parchment"],
  needs: ["kicker", "body", "bullets", "items", "note"],
  brief:
    "Teach one technique. Title names it in 3–6 words. `bullets` go on the handwritten card — 3 short lines that demonstrate it. `items` are the labelled sections underneath ('HOW TO USE IT', 'USEFUL FOR').",
  slideRange: [7, 10],
  pad: 80,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.055, "#7a5a32"));
    nodes.push(
      fixedBlock(c, `${c.index + 1}/${c.total}`, {
        x: cb.x + cb.w - 90,
        y: cb.y - 28,
        w: 90,
        size: 17,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.muted,
        align: "right",
        marks: {},
      }).node,
    );

    let y = cb.y + 6;
    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.62,
      maxH: cb.h * 0.3,
      font: c.fonts.serif,
      weight: 500,
      max: 82,
      min: 34,
      lineHeight: 1.08,
      marks: { accent: { color: c.pal.accent, weight: 600 } },
    });
    nodes.push(t.node);
    y += t.height + 18;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.56,
        size: 22,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.45,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 24;
    }

    // Rotated handwritten card.
    const lines = c.slide.bullets ?? [];
    if (lines.length) {
      const cw = cb.w * 0.5;
      const cx = cb.x + cb.w - cw + 10;
      const cy = cb.y + cb.h * 0.26;
      const inner = lines
        .slice(0, 4)
        .map((l, i) => `${i + 1}. ${l}`)
        .join("\n");
      const body = fixedBlock(c, inner, {
        x: cx + 24,
        y: 0,
        w: cw - 48,
        size: 21,
        font: c.fonts.hand,
        weight: 600,
        color: "#2c2418",
        lineHeight: 1.5,
        marks: {},
      });
      const chH = body.height + 52;
      const origin: [number, number] = [cx + cw / 2, cy + chH / 2];
      nodes.push(
        {
          kind: "rect",
          x: cx,
          y: cy,
          w: cw,
          h: chH,
          fill: "#fdf9ee",
          rotate: 0.035,
          origin,
          shadow: { color: "rgba(0,0,0,0.18)", blur: 26, x: 0, y: 10 },
        },
        { ...body.node, y: cy + 26, rotate: 0.035, origin },
        D.tape(c, cx + cw / 2 - 46, cy - 16, 92, 0.035),
      );
      if (c.slide.note) {
        nodes.push(
          fixedBlock(c, c.slide.note, {
            x: cx - 40,
            y: cy + chH + 22,
            w: cw * 0.7,
            size: 21,
            font: c.fonts.hand,
            weight: 700,
            color: c.pal.accent,
            marks: {},
          }).node,
        );
        nodes.push(...D.curvedArrow([cx - 46, cy + chH + 26], [cx + 40, cy + chH + 2], 26, c.pal.accent, 2.5));
      }
    }

    // Labelled sections along the bottom-left.
    let sy = Math.max(y, c.h - c.pad - 260);
    for (const item of (c.slide.items ?? []).slice(0, 2)) {
      nodes.push(
        fixedBlock(c, item.label, {
          x: cb.x,
          y: sy,
          w: cb.w * 0.5,
          size: 17,
          font: c.fonts.sans,
          weight: 800,
          color: c.pal.fg,
          letterSpacing: 2,
          uppercase: true,
          marks: {},
        }).node,
      );
      sy += 26;
      const b = fixedBlock(c, item.value, {
        x: cb.x + 18,
        y: sy,
        w: cb.w * 0.48,
        size: 20,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.35,
        marks: {},
      });
      nodes.push(b.node);
      sy += b.height + 22;
    }
    nodes.push(...D.footer(c, { y: c.h - c.pad + 6 }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 43 · Rank Card --------------------------- */

export const rankcard: Preset = {
  id: "rankcard",
  name: "Rank Card",
  category: "editorial",
  blurb: "One numbered entry per slide: the pick, why it wins, and a drawing.",
  defaultPalette: "slate",
  palettes: ["slate", "ink", "midnight", "cream", "notebook"],
  needs: ["kicker", "body", "bullets", "stat", "note"],
  brief:
    "Each body slide is entry N of a countdown. Title is the name of the pick (1–4 words). `kicker` is its category. `bullets` are 2–3 reasons it earns the spot, each under 8 words.",
  slideRange: [7, 11],
  pad: 82,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const isBody = c.slide.role === "body";

    let y = cb.y;
    if (isBody) {
      const r = 40;
      nodes.push(
        { kind: "ellipse", cx: cb.x + r, cy: y + r, rx: r, ry: r, stroke: c.pal.accent, lineWidth: 4 },
        fixedBlock(c, String(c.index), {
          x: cb.x,
          y: y + r - 26,
          w: r * 2,
          size: 44,
          font: c.fonts.sans,
          weight: 800,
          color: c.pal.accent,
          align: "center",
          marks: {},
        }).node,
      );
      y += r * 2 + 22;
    }

    if (c.slide.kicker) {
      nodes.push(
        fixedBlock(c, c.slide.kicker, {
          x: cb.x,
          y,
          w: cb.w,
          size: 19,
          font: c.fonts.sans,
          weight: 700,
          color: c.pal.muted,
          letterSpacing: 3,
          uppercase: true,
          marks: {},
        }).node,
      );
      y += 32;
    }

    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w,
      maxH: cb.h * 0.26,
      font: c.fonts.sans,
      weight: 800,
      max: 88,
      min: 34,
      lineHeight: 1.04,
      letterSpacing: -2,
      uppercase: true,
      marks: { accent: { color: c.pal.accent, weight: 800 } },
    });
    nodes.push(t.node);
    y += t.height + 18;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.86,
        size: 24,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.42,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 20;
    }
    for (const item of (c.slide.bullets ?? []).slice(0, 3)) {
      const b = fixedBlock(c, item, {
        x: cb.x + 30,
        y,
        w: cb.w * 0.8,
        size: 22,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.fg,
        lineHeight: 1.28,
        marks: {},
      });
      nodes.push(D.arrow(cb.x, y + 12, 20, c.pal.accent, 2.5), b.node);
      y += b.height + 14;
    }

    if (c.slide.stat) {
      const ch = D.chip(c, `${c.slide.stat.value} · ${c.slide.stat.label}`, {
        x: cb.x,
        y: y + 10,
        size: 18,
        fill: withAlpha(c.pal.accent2, 0.18),
        color: c.pal.accent2,
        letterSpacing: 0.5,
        uppercase: false,
      });
      nodes.push(...ch.nodes);
    }

    // Drawing anchored bottom-right.
    const figS = Math.min(280, c.h - c.pad - 90 - y);
    if (figS > 110) {
      const fx = cb.x + cb.w - figS;
      const fy = c.h - c.pad - figS - 30;
      const g = P.icon(iconFor(c.slide.title), fx, fy, figS, withAlpha(c.pal.accent, 0.3), { width: figS * 0.035 });
      if (g) nodes.push(g);
    }
    if (c.slide.note) {
      nodes.push(
        ...P.speechBubble(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 128,
          w: Math.min(cb.w * 0.52, 400),
          size: 21,
          fill: c.pal.surface,
          stroke: withAlpha(c.pal.fg, 0.3),
          color: c.pal.fg,
          tail: "bl",
        }),
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 44 · Spec Sheet -------------------------- */

export const specsheet: Preset = {
  id: "specsheet",
  name: "Spec Sheet",
  category: "minimal",
  blurb: "Mono meta, a condensed numbered title, two compare cards and footnotes.",
  defaultPalette: "slate",
  palettes: ["slate", "ink", "cream", "parchment"],
  needs: ["kicker", "body", "compare", "bullets", "note"],
  brief:
    "A designer's spec sheet. Title is a section name of 1–3 words. `compare` sets the two cards ('BEFORE' / 'AFTER', 'GENERIC' / 'CONSIDERED'), 2–3 items each. `bullets` are footnotes.",
  slideRange: [6, 9],
  pad: 74,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const meta = withAlpha(c.pal.muted, 0.9);

    nodes.push(
      fixedBlock(c, `${String(c.index + 1).padStart(2, "0")} —`, {
        x: cb.x,
        y: cb.y - 22,
        w: 160,
        size: 15,
        font: c.fonts.mono,
        weight: 600,
        color: meta,
        letterSpacing: 1.5,
        uppercase: true,
        marks: {},
      }).node,
      fixedBlock(c, c.slide.kicker ?? c.deck.topic, {
        x: cb.x + cb.w - 340,
        y: cb.y - 22,
        w: 340,
        size: 15,
        font: c.fonts.mono,
        weight: 500,
        color: meta,
        align: "right",
        letterSpacing: 1.5,
        uppercase: true,
        marks: {},
      }).node,
    );
    for (let i = 0; i < 9; i++) {
      nodes.push({ kind: "rect", x: cb.x + cb.w - 46 + (i % 3) * 12, y: cb.y - 4 + Math.floor(i / 3) * 12, w: 5, h: 5, fill: withAlpha(c.pal.fg, 0.3) });
    }

    let y = cb.y + 26;
    const t = block(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.8,
      maxH: cb.h * 0.26,
      font: c.fonts.condensed,
      weight: 700,
      max: 92,
      min: 34,
      lineHeight: 0.98,
      letterSpacing: -0.5,
      uppercase: true,
      marks: { accent: { color: c.pal.accent, weight: 700 } },
    });
    nodes.push(t.node);
    y += t.height + 16;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x + cb.w * 0.42,
        y: cb.y + 30,
        w: cb.w * 0.58,
        size: 18,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.5,
        marks: {},
      });
      nodes.push(b.node);
      y = Math.max(y, cb.y + 30 + b.height + 24);
    }

    // Two wireframe cards with an arrow between them.
    const cmp = c.slide.compare;
    const cardH = Math.min(330, c.h - c.pad - 150 - y);
    if (cardH > 130) {
      const cw = (cb.w - 66) / 2;
      [0, 1].forEach((i) => {
        const x = cb.x + i * (cw + 66);
        nodes.push(...P.windowCard(c, x, y, cw, cardH, { rows: 5, accent: i === 1 ? c.pal.accent : c.pal.muted, radius: 8 }));
        const label = i === 0 ? cmp?.leftLabel : cmp?.rightLabel;
        if (label) {
          nodes.push(
            fixedBlock(c, label, {
              x,
              y: y + cardH + 12,
              w: cw,
              size: 14,
              font: c.fonts.mono,
              weight: 700,
              color: i === 1 ? c.pal.accent : meta,
              letterSpacing: 1.5,
              uppercase: true,
              marks: {},
            }).node,
          );
          const items = (i === 0 ? cmp?.leftItems : cmp?.rightItems) ?? [];
          let iy = y + cardH + 34;
          for (const it of items.slice(0, 3)) {
            const b = fixedBlock(c, it, {
              x,
              y: iy,
              w: cw,
              size: 15,
              font: c.fonts.sans,
              weight: 500,
              color: c.pal.fg,
              lineHeight: 1.25,
              marks: {},
            });
            nodes.push(b.node);
            iy += b.height + 6;
          }
        }
      });
      nodes.push(D.arrow(cb.x + cw + 16, y + cardH / 2, 34, c.pal.fg, 2));
    }

    let fy = c.h - c.pad - 44;
    for (const b of (c.slide.bullets ?? []).slice(0, 2).reverse()) {
      const blk = fixedBlock(c, b, {
        x: cb.x + 14,
        y: fy,
        w: cb.w * 0.7,
        size: 14,
        font: c.fonts.mono,
        weight: 500,
        color: meta,
        lineHeight: 1.3,
        marks: {},
      });
      nodes.push({ kind: "rect", x: cb.x, y: fy + 4, w: 6, h: 6, fill: c.pal.accent }, blk.node);
      fy -= blk.height + 8;
    }
    nodes.push(
      { kind: "line", x1: cb.x, y1: c.h - c.pad - 6, x2: cb.x + cb.w, y2: c.h - c.pad - 6, stroke: withAlpha(c.pal.fg, 0.2), lineWidth: 1 },
      fixedBlock(c, `${c.deck.handle || ""}   ${c.slide.note ?? ""}`, {
        x: cb.x,
        y: c.h - c.pad + 6,
        w: cb.w,
        size: 13,
        font: c.fonts.mono,
        weight: 600,
        color: meta,
        letterSpacing: 1.5,
        uppercase: true,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 45 · Essay ----------------------------- */

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

    // Monoline drawing composed from the icon set, bottom-right.
    const figS = Math.min(300, c.h - c.pad - 70 - y);
    if (figS > 120) {
      const fx = cb.x + cb.w - figS - 10;
      const fy = c.h - c.pad - figS - 20;
      const g = P.icon(iconFor(c.slide.title + (c.slide.body ?? "")), fx, fy, figS, withAlpha(c.pal.fg, 0.55), {
        width: Math.max(2, figS * 0.018),
      });
      if (g) nodes.push(g);
      // A few structural lines to make it read as a scene rather than an icon.
      nodes.push({
        kind: "line",
        x1: fx - 30,
        y1: fy + figS + 10,
        x2: fx + figS + 10,
        y2: fy + figS + 10,
        stroke: withAlpha(c.pal.fg, 0.4),
        lineWidth: 2,
      });
    }
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
