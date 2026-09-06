import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as G from "../render/diagrams";
import { iconFor } from "../render/icons";
import * as P from "../render/props";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import type { SlidePanel, SlideRanked } from "../types";
import { bodyBox, defaultShell, headStack, scene } from "./_shared";
import type { Preset } from "./types";

/** Fall back to bullets when the writer did not supply structured data. */
function asRanked(c: Ctx): SlideRanked[] {
  if (c.slide.ranked?.length) return c.slide.ranked;
  if (c.slide.items?.length) return c.slide.items.map((i) => ({ label: i.label, value: i.value }));
  return (c.slide.bullets ?? []).map((b) => ({ label: b }));
}

function asNodes(c: Ctx): { label: string; text?: string }[] {
  if (c.slide.steps?.length) return c.slide.steps.map((s) => ({ label: s.label, text: s.text }));
  if (c.slide.ranked?.length) return c.slide.ranked.map((r) => ({ label: r.label, text: r.note }));
  if (c.slide.items?.length) return c.slide.items.map((i) => ({ label: i.label, text: i.value }));
  return (c.slide.bullets ?? []).map((b) => ({ label: b }));
}

function asPanels(c: Ctx): SlidePanel[] {
  if (c.slide.panels?.length) return c.slide.panels;
  if (c.slide.compare) {
    return [
      { title: c.slide.compare.leftLabel, items: c.slide.compare.leftItems },
      { title: c.slide.compare.rightLabel, items: c.slide.compare.rightItems },
    ];
  }
  const b = c.slide.bullets ?? [];
  if (b.length >= 4) {
    const half = Math.ceil(b.length / 2);
    return [
      { title: "First", items: b.slice(0, half) },
      { title: "Then", items: b.slice(half) },
    ];
  }
  return [];
}

/* --------------------------- 26 · Stat List ---------------------------- */

export const statlist: Preset = {
  id: "statlist",
  name: "Stat List",
  category: "data",
  blurb: "Rank badge, icon, label and a big figure per row. The most scannable list there is.",
  defaultPalette: "slate",
  palettes: ["slate", "midnight", "electric", "notebook", "candy"],
  needs: ["kicker", "body", "ranked", "note"],
  brief:
    "Every body slide is a ranked list. Fill `ranked` with 4–6 entries in order: `label` is 1–3 words, `value` is the short figure that makes it scannable ('92%', '3.2×', '$4.8B'), `note` is an optional half-line of context. Only use figures you can source.",
  slideRange: [7, 9],
  pad: 76,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      titleMax: c.slide.role === "cover" ? 96 : 66,
      titleMin: 34,
      titleLH: 1.05,
      titleLS: -2,
      bodySize: 25,
      bodyLH: 1.38,
      kickerSize: 21,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.26 });
    nodes.push(...head.nodes);

    const footH = c.slide.note ? 106 : 62;
    const zone = { x: cb.x, y: head.bottom + 8, w: cb.w, h: c.h - c.pad - footH - head.bottom - 8 };
    nodes.push(...G.rankRows(c, zone, asRanked(c)));

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 88,
          w: cb.w,
          size: 21,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 27 · Ranking ----------------------------- */

export const ranking: Preset = {
  id: "ranking",
  name: "Ranking",
  category: "data",
  blurb: "A tiered podium — one at the top, widening rows beneath. Built for 'top N' posts.",
  defaultPalette: "cream",
  palettes: ["cream", "slate", "paper", "parchment", "midnight"],
  needs: ["kicker", "ranked", "note"],
  brief:
    "A leaderboard. `ranked` holds 6–10 entries in strict order, `label` 1–2 words and `value` the figure being ranked. The title states what is being ranked and over what population.",
  slideRange: [6, 9],
  pad: 80,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      align: "center",
      titleFont: "serif",
      titleWeight: 500,
      titleMax: c.slide.role === "cover" ? 88 : 62,
      titleMin: 32,
      titleLH: 1.1,
      titleLS: -0.5,
      kickerSize: 20,
      kickerLS: 3,
      kickerColor: c.pal.muted,
      bodySize: 24,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24, gap: 12 });
    nodes.push(...head.nodes);

    const zone = { x: cb.x, y: head.bottom + 14, w: cb.w, h: c.h - c.pad - 76 - head.bottom - 14 };
    nodes.push(...G.rankPyramid(c, zone, asRanked(c)));

    nodes.push(
      fixedBlock(c, c.slide.note ?? c.deck.handle ?? "", {
        x: cb.x,
        y: c.h - c.pad + 6,
        w: cb.w,
        size: 17,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        align: "center",
        marks: {},
      }).node,
    );
    nodes.push(D.grain(c, 0.04, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 28 · Data Table -------------------------- */

export const datatable: Preset = {
  id: "datatable",
  name: "Data Table",
  category: "data",
  blurb: "An actual comparison grid — header row, aligned columns, zebra rows.",
  defaultPalette: "notebook",
  palettes: ["notebook", "slate", "ink", "terminal", "parchment"],
  needs: ["kicker", "body", "table", "note"],
  brief:
    "Every body slide carries a `table`. Use 3 columns and 3–5 rows; the first column is the thing being compared. Every cell must fit in about 18 characters — abbreviate rather than wrap.",
  slideRange: [6, 9],
  pad: 72,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      titleMax: c.slide.role === "cover" ? 90 : 60,
      titleMin: 32,
      titleLH: 1.06,
      titleLS: -1.6,
      bodySize: 24,
      bodyLH: 1.36,
      kickerSize: 20,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24 });
    nodes.push(...head.nodes);

    const footH = c.slide.note ? 110 : 66;
    const zone = { x: cb.x, y: head.bottom + 10, w: cb.w, h: c.h - c.pad - footH - head.bottom - 10 };
    const table = c.slide.table ?? {
      columns: ["Item", "Detail"],
      // Degrade to a two-column grid rather than an empty slide.
      rows: (c.slide.items ?? (c.slide.bullets ?? []).map((b) => ({ label: b, value: "" }))).map((i) => [
        i.label,
        i.value,
      ]),
    };
    if (table.rows.length) {
      const h = G.tableHeight(c, zone, table);
      nodes.push(...G.dataTable(c, { ...zone, y: zone.y + Math.max(0, (zone.h - h) / 2) }, table));
    }

    if (c.slide.note) {
      nodes.push(
        { kind: "rect", x: cb.x, y: c.h - c.pad - 92, w: 5, h: 48, fill: c.pal.accent },
        fixedBlock(c, c.slide.note, {
          x: cb.x + 20,
          y: c.h - c.pad - 84,
          w: cb.w - 24,
          size: 22,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 29 · Layer Stack -------------------------- */

export const layerstack: Preset = {
  id: "layerstack",
  name: "Layer Stack",
  category: "technical",
  blurb: "Isometric numbered slabs — for models, tiers and anything with levels.",
  defaultPalette: "notebook",
  palettes: ["notebook", "blueprint", "slate", "parchment"],
  needs: ["kicker", "body", "steps", "note"],
  brief:
    "Describe something with levels, bottom to top. `steps` holds 4–7 layers ordered from lowest to highest; `label` is the layer's name (1–3 words) and `text` is a 3–6 word gloss.",
  slideRange: [6, 9],
  pad: 76,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...P.gridPaper(c, withAlpha(c.pal.fg, 0.05), 48, 1));
    const s = defaultShell(c, {
      titleMax: c.slide.role === "cover" ? 92 : 62,
      titleMin: 32,
      titleLH: 1.06,
      titleLS: -1.6,
      bodySize: 24,
      kickerSize: 20,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24 });
    nodes.push(...head.nodes);

    const zone = { x: cb.x, y: head.bottom + 10, w: cb.w, h: c.h - c.pad - 74 - head.bottom - 10 };
    nodes.push(...G.layerStack(c, zone, asNodes(c)));

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad + 4,
          w: cb.w * 0.7,
          size: 20,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.muted,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c, { showSwipe: c.index < c.total - 1, y: c.h - c.pad + 26 }));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 30 · Mind Map --------------------------- */

export const mindmap: Preset = {
  id: "mindmap",
  name: "Mind Map",
  category: "technical",
  blurb: "One subject at the centre, everything it touches radiating out.",
  defaultPalette: "notebook",
  palettes: ["notebook", "lavender", "cream", "midnight", "chalk"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Map one concept. The title names the hub in 1–3 words. `bullets` are the 5–7 things that hang off it, each 1–2 words so they fit the nodes.",
  slideRange: [6, 9],
  pad: 74,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.dotGrid(c, 52, 2, withAlpha(c.pal.fg, 0.09)));
    const s = defaultShell(c, {
      align: "center",
      titleMax: c.slide.role === "cover" ? 86 : 58,
      titleMin: 30,
      titleLH: 1.06,
      titleLS: -1.4,
      bodySize: 23,
      kickerSize: 20,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.2, gap: 12 });
    nodes.push(...head.nodes);

    const zoneTop = head.bottom + 20;
    const zoneH = c.h - c.pad - 70 - zoneTop;
    const cx = c.w / 2;
    const cy = zoneTop + zoneH / 2;
    const radius = Math.min(cb.w * 0.36, zoneH * 0.38);
    const hubWords = c.slide.title.split(/\s+/).slice(0, 2).join(" ");
    nodes.push(
      ...G.hubSpoke(c, cx, cy, radius, hubWords, (c.slide.bullets ?? []).map((b) => ({ label: b })), {
        hubR: radius * 0.36,
      }),
    );

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 30,
          w: cb.w,
          size: 22,
          font: c.fonts.hand,
          weight: 700,
          color: c.pal.accent2,
          align: "center",
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 31 · Spectrum --------------------------- */

export const spectrum: Preset = {
  id: "spectrum",
  name: "Spectrum",
  category: "technical",
  blurb: "A labelled scale from one extreme to the other, with panels underneath.",
  defaultPalette: "cream",
  palettes: ["cream", "notebook", "slate", "parchment"],
  needs: ["kicker", "body", "steps", "panels", "note"],
  brief:
    "Place things on a scale. `steps` are the 4–5 points along it in order (`label` 1–2 words, `text` a 2–4 word gloss); `kicker` names what the axis measures. `panels` add two supporting groups underneath.",
  slideRange: [6, 9],
  pad: 74,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      titleMax: c.slide.role === "cover" ? 90 : 60,
      titleMin: 30,
      titleLH: 1.06,
      titleLS: -1.6,
      bodySize: 23,
      kickerSize: 20,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.22 });
    nodes.push(...head.nodes);

    const panels = asPanels(c);
    const axisH = 190;
    const axisBox = { x: cb.x, y: head.bottom + 10, w: cb.w, h: axisH };
    nodes.push(
      ...G.axisScale(c, axisBox, asNodes(c), {
        caption: c.slide.kicker ? undefined : "increases →",
      }),
    );

    if (panels.length) {
      const top = axisBox.y + axisH + 22;
      const zone = { x: cb.x, y: top, w: cb.w, h: c.h - c.pad - 66 - top };
      if (zone.h > 120) nodes.push(...G.panelGrid(c, zone, panels));
    }
    nodes.push(...D.footer(c));
    nodes.push(D.grain(c, 0.04, "#000000"));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 32 · Bento ----------------------------- */

export const bento: Preset = {
  id: "bento",
  name: "Bento",
  category: "data",
  blurb: "A mosaic of mixed-size cards — headline, numbers and little charts together.",
  defaultPalette: "slate",
  palettes: ["slate", "midnight", "electric", "candy", "highlighter"],
  needs: ["kicker", "stat", "ranked", "bullets", "note"],
  brief:
    "Pack one slide with several small facts. `ranked` supplies 3–5 tiles (`label` 1–3 words, `value` a short figure); `stat` becomes the hero tile. Keep every label short — these are cards, not sentences.",
  slideRange: [6, 9],
  pad: 66,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const ranked = asRanked(c);
    const kinds: G.BentoCell["kind"][] = ["chart", "donut", "spark", "icon"];

    const cells: G.BentoCell[] = [
      { cols: 4, rows: 1, label: c.slide.title, kind: "text" },
    ];
    if (c.slide.stat) {
      cells.push({ cols: 2, rows: 1, value: c.slide.stat.value, label: c.slide.stat.label });
    }
    ranked.slice(0, 5).forEach((r, i) => {
      cells.push({
        cols: i === 0 && !c.slide.stat ? 2 : i % 3 === 2 ? 2 : 1,
        rows: 1,
        label: r.label,
        value: r.value,
        kind: r.value ? undefined : kinds[i % kinds.length],
      });
    });
    if (cells.length < 5) cells.push({ cols: 2, rows: 1, label: c.deck.handle || "", kind: "spark" });

    const footH = c.slide.note ? 88 : 56;
    const zone = { x: cb.x, y: cb.y, w: cb.w, h: c.h - c.pad - footH - cb.y };
    nodes.push(...G.bentoGrid(c, zone, cells, { rowCount: Math.min(5, Math.max(3, cells.length)) }));

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 66,
          w: cb.w,
          size: 20,
          font: c.fonts.sans,
          weight: 500,
          color: c.pal.muted,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 33 · Process Flow ------------------------- */

export const processflow: Preset = {
  id: "processflow",
  name: "Process Flow",
  category: "editorial",
  blurb: "Three to five stages in a row, with icons, arrows and a payoff strip.",
  defaultPalette: "cream",
  palettes: ["cream", "clay", "slate", "parchment", "lavender"],
  needs: ["kicker", "body", "steps", "bullets", "note"],
  brief:
    "Describe a process end to end. `steps` are the 3–5 stages in order (`label` 1–2 words, `text` a 3–6 word gloss). `bullets` become the payoff row underneath — 3 short benefits.",
  slideRange: [6, 9],
  pad: 78,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      align: "center",
      titleMax: c.slide.role === "cover" ? 96 : 64,
      titleMin: 32,
      titleLH: 1.06,
      titleLS: -1.6,
      bodySize: 24,
      bodyLH: 1.4,
      kickerChip: { fill: withAlpha(c.pal.accent2, 0.2), color: c.pal.accent2, radius: 999 },
      kickerSize: 20,
      kickerLS: 2,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.26, gap: 18 });
    nodes.push(...head.nodes);

    const benefits = c.slide.bullets ?? [];
    const benefitH = benefits.length ? 130 : 0;
    const flowTop = head.bottom + 24;
    const flowH = c.h - c.pad - 62 - benefitH - flowTop;
    if (flowH > 120) {
      nodes.push(...G.nodeFlow(c, { x: cb.x, y: flowTop, w: cb.w, h: flowH }, asNodes(c)));
    }

    if (benefits.length) {
      const by = c.h - c.pad - 62 - benefitH + 16;
      const step = cb.w / Math.min(3, benefits.length);
      benefits.slice(0, 3).forEach((b, i) => {
        const x = cb.x + step * i;
        nodes.push({
          kind: "rect",
          x: x + 6,
          y: by,
          w: step - 12,
          h: 84,
          r: 18,
          fill: withAlpha(c.pal.accent, 0.1),
        });
        const g = P.icon(iconFor(b), x + 22, by + 24, 34, c.pal.accent, { width: 2.5 });
        if (g) nodes.push(g);
        nodes.push(
          fixedBlock(c, b, {
            x: x + 66,
            y: by + 26,
            w: step - 84,
            size: 19,
            font: c.fonts.sans,
            weight: 600,
            color: c.pal.fg,
            lineHeight: 1.18,
            marks: {},
          }).node,
        );
      });
    }
    nodes.push(...P.sparkleField(c, withAlpha(c.pal.accent, 0.5), 4, { min: 10, max: 20 }));
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* --------------------------- 34 · Architecture ------------------------- */

export const architecture: Preset = {
  id: "architecture",
  name: "Architecture",
  category: "technical",
  blurb: "Component boxes wired together, with a process strip along the foot.",
  defaultPalette: "midnight",
  palettes: ["midnight", "blueprint", "terminal", "parchment", "highlighter"],
  needs: ["kicker", "body", "steps", "bullets", "note"],
  brief:
    "Show how a system fits together. `steps` are the 3–6 components (`label` 1–2 words, `text` one clause on what it does). `bullets` become the bottom pipeline strip — 4–5 single words in order.",
  slideRange: [6, 9],
  pad: 72,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.gridLines(c, 64, withAlpha(c.pal.fg, 0.05)));
    const s = defaultShell(c, {
      titleFont: "condensed",
      titleWeight: 700,
      titleMax: c.slide.role === "cover" ? 100 : 70,
      titleMin: 32,
      titleLH: 1.0,
      titleLS: 0,
      titleUpper: true,
      bodyFont: "mono",
      bodySize: 21,
      bodyLH: 1.45,
      kickerFont: "mono",
      kickerSize: 18,
      kickerLS: 2,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24 });
    nodes.push(...head.nodes);

    const strip = c.slide.bullets ?? [];
    const stripH = strip.length ? 92 : 0;
    const zone = {
      x: cb.x,
      y: head.bottom + 12,
      w: cb.w,
      h: c.h - c.pad - 62 - stripH - head.bottom - 12,
    };
    if (zone.h > 130) nodes.push(...G.componentGraph(c, zone, asNodes(c)));

    if (strip.length) {
      const sy = c.h - c.pad - 62 - stripH + 18;
      nodes.push({ kind: "rect", x: cb.x, y: sy, w: cb.w, h: 54, r: 10, fill: withAlpha(c.pal.fg, 0.06) });
      const step = cb.w / strip.length;
      strip.slice(0, 6).forEach((label, i) => {
        const cx = cb.x + step * i + step / 2;
        nodes.push(
          fixedBlock(c, label, {
            x: cx - step / 2 + 6,
            y: sy + 18,
            w: step - 12,
            size: 17,
            font: c.fonts.mono,
            weight: 700,
            color: c.pal.accent,
            align: "center",
            uppercase: true,
            letterSpacing: 1,
            marks: {},
          }).node,
        );
        if (i < Math.min(6, strip.length) - 1) {
          nodes.push(D.arrow(cx + step * 0.34, sy + 27, step * 0.32, withAlpha(c.pal.fg, 0.4), 1.5));
        }
      });
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ------------------------------ 35 · Panels ---------------------------- */

export const panels: Preset = {
  id: "panels",
  name: "Panels",
  category: "editorial",
  blurb: "Two to four titled boxes — do/don't, before/after, or four quadrants.",
  defaultPalette: "slate",
  palettes: ["slate", "notebook", "cream", "midnight", "lavender"],
  needs: ["kicker", "body", "panels", "note"],
  brief:
    "Group related points. `panels` holds 2–4 groups; `title` is 1–3 words (e.g. 'Do', 'Skip', 'When to use') and each `items` entry is under 8 words. Balance the groups — similar item counts read better.",
  slideRange: [6, 9],
  pad: 76,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      titleMax: c.slide.role === "cover" ? 92 : 62,
      titleMin: 32,
      titleLH: 1.06,
      titleLS: -1.6,
      bodySize: 24,
      kickerSize: 20,
      kickerLS: 3,
    });
    const head = headStack(c, s, cb, { titleMaxH: cb.h * 0.24 });
    nodes.push(...head.nodes);

    const list = asPanels(c);
    const footH = c.slide.note ? 100 : 62;
    const zone = { x: cb.x, y: head.bottom + 12, w: cb.w, h: c.h - c.pad - footH - head.bottom - 12 };
    nodes.push(...G.panelGrid(c, zone, list, { cols: list.length === 3 ? 3 : undefined }));

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 82,
          w: cb.w,
          size: 22,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          align: "center",
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};
