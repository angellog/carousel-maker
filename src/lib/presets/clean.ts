import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as P from "../render/props";
import { iconFor } from "../render/icons";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import {
  bodyPart,
  bulletsPart,
  chatPart,
  comparePart,
  defaultShell,
  featurePart,
  kickerPart,
  layoutParts,
  notePart,
  scene,
  statPart,
  titlePart,
} from "./_shared";
import type { Preset } from "./types";

/* --------------------------- 21 · Studio Minimal ------------------------ */

export const studiomin: Preset = {
  id: "studiomin",
  name: "Studio Minimal",
  category: "minimal",
  blurb: "Quiet white deck: tiny mono meta, restrained type, soft mockup cards.",
  defaultPalette: "slate",
  palettes: ["slate", "cream", "ink", "paper"],
  needs: ["body", "bullets", "note"],
  brief:
    "Understated and confident — a design studio talking to peers. No exclamation marks, no emoji. Title is a fragment that trails ('So we obsess over…'). `bullets` are three short parallel phrases.",
  slideRange: [8, 10],
  pad: 96,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const meta = withAlpha(c.pal.muted, 0.85);
    nodes.push(
      fixedBlock(c, String(c.index + 1).padStart(2, "0"), {
        x: cb.x,
        y: cb.y - 28,
        w: 120,
        size: 16,
        font: c.fonts.mono,
        weight: 500,
        color: meta,
        letterSpacing: 1,
        marks: {},
      }).node,
      fixedBlock(c, `© ${new Date().getFullYear()}`, {
        x: cb.x + cb.w - 120,
        y: cb.y - 28,
        w: 120,
        size: 16,
        font: c.fonts.mono,
        weight: 500,
        color: meta,
        align: "right",
        letterSpacing: 1,
        marks: {},
      }).node,
    );

    const mockH = 300;
    const box = { x: cb.x, y: cb.y + 40, w: cb.w * 0.86, h: cb.h - mockH - 110 };
    const s = defaultShell(c, {
      align: "left",
      justify: "center",
      titleFont: "sans",
      titleWeight: 700,
      titleMax: c.slide.role === "cover" ? 88 : 62,
      titleMin: 32,
      titleLH: 1.14,
      titleLS: -1.4,
      bodySize: 27,
      bodyLH: 1.55,
      bodyColor: c.pal.muted,
      bullet: "none",
      gap: 30,
      marks: {
        accent: { color: c.pal.accent, weight: 700 },
        highlight: { highlight: withAlpha(c.pal.accent, 0.16) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    const parts = [titlePart(c, s, box), bodyPart(c, s, box)];
    // Bullets are rendered as a quiet stacked list, not a bulleted one.
    if (c.slide.bullets?.length) {
      const listText = c.slide.bullets.join("\n");
      parts.push(
        bodyPart(c, { ...s, bodyColor: withAlpha(c.pal.muted, 0.95), bodyLH: 1.5 }, box, listText),
      );
    }
    nodes.push(...layoutParts(parts, box, s.gap, "center"));

    // Soft mockup card row.
    const my = c.h - c.pad - mockH + 30;
    const cardW = (cb.w - 40) / 3;
    for (let i = 0; i < 3; i++) {
      const x = cb.x + i * (cardW + 20);
      nodes.push(D.card(c, x, my, cardW, mockH - 90, { fill: c.pal.surface, radius: 10 }));
      const seed = c.slide.bullets?.[i] ?? `${c.slide.title}-${i}`;
      if (i === 1) {
        const g = P.icon(iconFor(seed), x + cardW / 2 - 34, my + 50, 68, c.pal.fg, { width: 2.5 });
        if (g) nodes.push(g);
      }
      const rows = i === 1 ? 3 : 6;
      for (let r = 0; r < rows; r++) {
        nodes.push({
          kind: "rect",
          x: x + 22,
          y: my + (i === 1 ? 150 : 30) + r * 22,
          w: (cardW - 44) * (0.5 + ((r * 29) % 50) / 100),
          h: 7,
          r: 4,
          fill: withAlpha(c.pal.fg, r === 0 ? 0.34 : 0.13),
        });
      }
    }
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 6,
        w: cb.w * 0.6,
        size: 17,
        font: c.fonts.sans,
        weight: 600,
        color: c.pal.fg,
        marks: {},
      }).node,
      fixedBlock(c, c.deck.audience, {
        x: cb.x,
        y: c.h - c.pad + 28,
        w: cb.w * 0.6,
        size: 15,
        font: c.fonts.sans,
        weight: 400,
        color: meta,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 22 · Warm Serif --------------------------- */

export const warmserif: Preset = {
  id: "warmserif",
  name: "Warm Serif",
  category: "editorial",
  blurb: "Cream stock, serif headline with a drawn underline, a floating product card.",
  defaultPalette: "cream",
  palettes: ["cream", "clay", "parchment", "paper"],
  needs: ["kicker", "body", "bullets", "note"],
  brief:
    "Warm, first-person, builder's voice. Title 4–10 words across two or three lines; mark the final phrase with **accent** so it gets the drawn underline. `body` is one or two short lines.",
  slideRange: [7, 10],
  pad: 86,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(D.grain(c, 0.05, "#7a5a32"));

    // Mono header row.
    const label = `${String(c.index + 1).padStart(2, "0")}/${String(c.total).padStart(2, "0")}`;
    nodes.push(
      fixedBlock(c, label, {
        x: cb.x,
        y: cb.y - 22,
        w: 120,
        size: 18,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        letterSpacing: 1,
        marks: {},
      }).node,
      fixedBlock(c, c.slide.kicker ?? c.deck.topic, {
        x: cb.x + 108,
        y: cb.y - 22,
        w: cb.w - 190,
        size: 18,
        font: c.fonts.mono,
        weight: 500,
        color: c.pal.muted,
        letterSpacing: 1,
        marks: {},
      }).node,
      D.arrow(cb.x + cb.w - 54, cb.y - 12, 54, c.pal.fg, 2),
    );
    nodes.push({ kind: "line", x1: cb.x, y1: cb.y + 14, x2: cb.x + cb.w, y2: cb.y + 14, stroke: withAlpha(c.pal.fg, 0.2), lineWidth: 1 });

    let y = cb.y + 56;
    const t = fixedBlock(c, c.slide.title, {
      x: cb.x,
      y,
      w: cb.w * 0.9,
      size: c.slide.role === "cover" ? 84 : 66,
      font: c.fonts.serif,
      weight: 500,
      color: c.pal.fg,
      lineHeight: 1.14,
      letterSpacing: -0.5,
      marks: {
        accent: { color: c.pal.accent, weight: 600 },
        highlight: { highlight: withAlpha(c.pal.accent, 0.2) },
        underline: { underline: c.pal.accent },
        strike: { strike: c.pal.muted, color: c.pal.muted },
      },
    });
    nodes.push(t.node);
    const lastLine = t.node.lines[t.node.lines.length - 1];
    y += t.height + 4;
    if (lastLine) {
      nodes.push(...D.sketchUnderline(c, cb.x, y - 6, Math.min(lastLine.width, cb.w * 0.8), withAlpha(c.pal.accent, 0.75), 6));
    }
    y += 34;

    if (c.slide.body) {
      const b = fixedBlock(c, c.slide.body, {
        x: cb.x,
        y,
        w: cb.w * 0.8,
        size: 25,
        font: c.fonts.sans,
        weight: 500,
        color: c.pal.muted,
        lineHeight: 1.5,
        marks: {},
      });
      nodes.push(b.node);
      y += b.height + 16;
    }
    if (c.slide.bullets?.length) {
      const s = defaultShell(c, { bodySize: 24, bullet: "dash", bulletColor: c.pal.accent, bulletGap: 12 });
      const bl = bulletsPart(c, s, { x: cb.x, y, w: cb.w * 0.8, h: 220 });
      if (bl) {
        nodes.push(...bl.draw(y));
        y += bl.h + 18;
      }
    }

    // Floating dark product card.
    const cardTop = Math.max(y + 20, c.h - c.pad - 380);
    const cardH = c.h - c.pad - 40 - cardTop;
    if (cardH > 140) {
      nodes.push(
        ...P.windowCard(c, cb.x + cb.w * 0.14, cardTop, cb.w * 0.86, cardH, {
          fill: "#15161a",
          bar: "#1f2126",
          rows: 5,
          accent: c.pal.accent,
          rotate: -0.012,
        }),
      );
    }
    nodes.push(
      ...P.sparkleField(c, withAlpha(c.pal.accent, 0.85), 5, {
        min: 14,
        max: 30,
        avoid: { x: cb.x, y: cb.y + 40, w: cb.w * 0.9, h: 300 },
      }),
    );
    nodes.push(
      fixedBlock(c, c.deck.handle || "", {
        x: cb.x,
        y: c.h - c.pad + 4,
        w: cb.w,
        size: 18,
        font: c.fonts.mono,
        weight: 600,
        color: c.pal.muted,
        marks: {},
      }).node,
    );
    return scene(c, c.pal.bg, nodes);
  },
};

/* ----------------------------- 23 · Compare ----------------------------- */

export const compare: Preset = {
  id: "compare",
  name: "Compare",
  category: "data",
  blurb: "Hard split: the wrong way on the left, the right way on the right.",
  defaultPalette: "ink",
  palettes: ["ink", "slate", "midnight", "notebook"],
  needs: ["kicker", "body", "compare", "note"],
  brief:
    "Contrast-driven. Every body slide carries `compare` with two labelled columns (e.g. 'MOST PEOPLE' vs 'DO THIS INSTEAD') and 3–4 short items each. Items are phrases, never sentences.",
  slideRange: [7, 9],
  pad: 84,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const cmp = c.slide.compare;

    let y = cb.y;
    const s = defaultShell(c, {
      align: "left",
      titleMax: c.slide.role === "cover" ? 96 : 66,
      titleMin: 34,
      titleLH: 1.06,
      titleLS: -1.8,
      bodySize: 26,
      bodyLH: 1.4,
      kickerSize: 21,
      kickerLS: 3,
      gap: 22,
    });
    for (const part of [kickerPart(c, s, { ...cb, y }), titlePart(c, s, { ...cb, y }, undefined, cb.h * 0.28), bodyPart(c, s, { ...cb, y })]) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 16;

    const footH = c.slide.note ? 110 : 66;
    const zoneH = c.h - c.pad - footH - y;
    if (cmp) {
      const colW = (cb.w - 30) / 2;
      const bad = "#ff4d4f";
      const good = c.pal.accent2 === c.pal.accent ? "#22c55e" : c.pal.accent2;
      ([
        [cmp.leftLabel, cmp.leftItems, bad, cb.x, false],
        [cmp.rightLabel, cmp.rightItems, good, cb.x + colW + 30, true],
      ] as const).forEach(([label, items, color, x, isGood]) => {
        nodes.push({
          kind: "rect",
          x,
          y,
          w: colW,
          h: zoneH,
          r: 20,
          fill: withAlpha(color, 0.08),
          stroke: withAlpha(color, 0.4),
          lineWidth: 2,
        });
        nodes.push(
          fixedBlock(c, label, {
            x: x + 24,
            y: y + 26,
            w: colW - 48,
            size: 23,
            font: c.fonts.sans,
            weight: 800,
            color,
            letterSpacing: 2,
            uppercase: true,
            lineHeight: 1.15,
            marks: {},
          }).node,
        );
        nodes.push({ kind: "line", x1: x + 24, y1: y + 74, x2: x + colW - 24, y2: y + 74, stroke: withAlpha(color, 0.35), lineWidth: 1.5 });
        let iy = y + 100;
        const size = Math.max(20, Math.min(26, (zoneH - 130) / Math.max(1, items.length) / 2.4));
        for (const item of items) {
          const b = fixedBlock(c, item, {
            x: x + 62,
            y: iy,
            w: colW - 86,
            size,
            font: c.fonts.sans,
            weight: 500,
            color: c.pal.fg,
            lineHeight: 1.3,
            marks: {},
          });
          const midY = iy + size * 0.66;
          nodes.push(
            isGood
              ? {
                  kind: "path",
                  d: `M ${x + 26} ${midY} L ${x + 34} ${midY + 9} L ${x + 48} ${midY - 11}`,
                  stroke: color,
                  lineWidth: 3.5,
                  cap: "round",
                  join: "round",
                }
              : {
                  kind: "path",
                  d: `M ${x + 28} ${midY - 9} L ${x + 46} ${midY + 9} M ${x + 46} ${midY - 9} L ${x + 28} ${midY + 9}`,
                  stroke: color,
                  lineWidth: 3.5,
                  cap: "round",
                },
            b.node,
          );
          iy += b.height + 22;
        }
      });
      // VS badge on the seam.
      const vs = D.chip(c, "VS", {
        x: cb.x + colW + 15 - 30,
        y: y + zoneH / 2 - 22,
        size: 20,
        fill: c.pal.fg,
        color: c.pal.bg,
        letterSpacing: 1,
        padX: 16,
      });
      nodes.push(...vs.nodes);
    } else {
      const f = featurePart(c, s, { x: cb.x, y, w: cb.w, h: zoneH });
      if (f) nodes.push(...f.draw(y));
    }

    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: c.h - c.pad - 92,
          w: cb.w,
          size: 24,
          font: c.fonts.sans,
          weight: 600,
          color: c.pal.fg,
          align: "center",
          marks: {
            accent: { color: c.pal.accent, weight: 800 },
            highlight: { highlight: withAlpha(c.pal.accent, 0.25) },
            underline: { underline: c.pal.accent },
            strike: { strike: c.pal.muted, color: c.pal.muted },
          },
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 24 · Data Card ---------------------------- */

export const datacard: Preset = {
  id: "datacard",
  name: "Data Card",
  category: "data",
  blurb: "One number, enormous, with a delta chip and a supporting chart.",
  defaultPalette: "midnight",
  palettes: ["midnight", "electric", "forest", "slate", "terminal"],
  needs: ["kicker", "body", "stat", "note"],
  brief:
    "Number-led. Every body slide carries a `stat`: `value` is short and typographic ('3.2×', '$4,800', '71%'), `label` explains it in under 10 words, and `delta` is an optional signed change. Only use figures you can stand behind.",
  slideRange: [7, 9],
  pad: 92,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];
    nodes.push(...D.gridLines(c, 90, withAlpha(c.pal.fg, 0.05)));

    const s = defaultShell(c, {
      align: "left",
      justify: "start",
      titleMax: c.slide.role === "cover" ? 92 : 58,
      titleMin: 32,
      titleLH: 1.08,
      titleLS: -1.6,
      bodySize: 26,
      bodyLH: 1.42,
      kickerSize: 21,
      kickerLS: 3,
      gap: 20,
    });

    let y = cb.y;
    for (const part of [kickerPart(c, s, cb), titlePart(c, s, cb, undefined, cb.h * 0.24)]) {
      if (!part) continue;
      nodes.push(...part.draw(y));
      y += part.h + s.gap;
    }
    y += 20;

    const chartH = 260;
    const statZone = { x: cb.x, y, w: cb.w, h: c.h - c.pad - chartH - 60 - y };
    const stat = statPart(c, s, statZone, { big: 260, valueColor: c.pal.fg });
    if (stat) {
      nodes.push(...stat.draw(y + Math.max(0, (statZone.h - stat.h) / 2)));
    } else {
      const f = featurePart(c, s, statZone) ?? bodyPart(c, s, statZone);
      if (f) nodes.push(...f.draw(y));
    }

    // Supporting chart along the bottom.
    const cy = c.h - c.pad - chartH + 30;
    const vals = Array.from({ length: 7 }, (_, i) => 3 + i * 1.4 + c.rand() * 2.4);
    nodes.push(
      ...D.sparkline(c, { x: cb.x, y: cy, w: cb.w, h: chartH - 110 }, vals, {
        color: c.pal.accent,
        fill: true,
        width: 5,
      }),
    );
    nodes.push({
      kind: "line",
      x1: cb.x,
      y1: cy + chartH - 106,
      x2: cb.x + cb.w,
      y2: cy + chartH - 106,
      stroke: withAlpha(c.pal.fg, 0.18),
      lineWidth: 1.5,
    });
    if (c.slide.note) {
      nodes.push(
        fixedBlock(c, c.slide.note, {
          x: cb.x,
          y: cy + chartH - 92,
          w: cb.w,
          size: 21,
          font: c.fonts.mono,
          weight: 500,
          color: c.pal.muted,
          letterSpacing: 0.5,
          marks: {},
        }).node,
      );
    }
    nodes.push(...D.footer(c));
    return scene(c, c.pal.bg, nodes);
  },
};

/* ---------------------------- 25 · Chat Thread -------------------------- */

export const chatthread: Preset = {
  id: "chatthread",
  name: "Chat Thread",
  category: "playful",
  blurb: "A conversation that reveals the point one bubble at a time.",
  defaultPalette: "midnight",
  palettes: ["midnight", "slate", "mono", "candy"],
  needs: ["kicker", "chat", "body", "note"],
  brief:
    "Write it as a real exchange. Every body slide carries `chat` with 2–4 turns alternating `them` and `me`; `them` asks the objection your audience actually has and `me` answers it in one tight line. Never more than 22 words per bubble.",
  slideRange: [7, 10],
  pad: 88,
  render(c) {
    const cb = contentBox(c);
    const nodes: Node[] = [];

    // Thread header.
    const name = c.deck.handle || "@you";
    nodes.push(...D.avatar(c, name, cb.x + 26, cb.y + 12, 26, { fill: c.pal.accent }));
    nodes.push(
      fixedBlock(c, name, {
        x: cb.x + 66,
        y: cb.y - 2,
        w: cb.w * 0.6,
        size: 25,
        font: c.fonts.sans,
        weight: 700,
        color: c.pal.fg,
        marks: {},
      }).node,
      fixedBlock(c, c.slide.kicker ?? c.deck.topic, {
        x: cb.x + 66,
        y: cb.y + 26,
        w: cb.w * 0.6,
        size: 19,
        font: c.fonts.sans,
        weight: 400,
        color: c.pal.muted,
        marks: {},
      }).node,
      { kind: "line", x1: cb.x, y1: cb.y + 68, x2: cb.x + cb.w, y2: cb.y + 68, stroke: withAlpha(c.pal.fg, 0.14), lineWidth: 1.5 },
    );

    let y = cb.y + 104;
    const s = defaultShell(c, { align: "left", bodySize: 27, bodyLH: 1.4 });

    if (c.slide.role === "cover" || !c.slide.chat) {
      const t = titlePart(
        c,
        defaultShell(c, { align: "left", titleMax: 92, titleMin: 36, titleLH: 1.06, titleLS: -2 }),
        { ...cb, y, h: cb.h - 200 },
      );
      if (t) {
        nodes.push(...t.draw(y));
        y += t.h + 26;
      }
    }

    const b = bodyPart(c, s, { x: cb.x, y: 0, w: cb.w, h: 200 });
    const bodyTop = c.h - c.pad - 96 - (b?.h ?? 0);
    const zoneH = bodyTop - 28 - y;
    const chat = chatPart(c, s, { x: cb.x, y, w: cb.w, h: zoneH }, {
      mine: c.pal.accent,
      mineText: c.pal.dark ? "#04121f" : "#ffffff",
      theirs: c.pal.dark ? "#2c2c2e" : "#ececed",
    });
    // Centre the thread in the space between the header and the closing line,
    // so short conversations do not leave the slide looking half-empty.
    if (chat) nodes.push(...chat.draw(y + Math.max(0, (zoneH - chat.h) / 2)));
    if (b) nodes.push(...b.draw(bodyTop));

    // Composer bar, for the messaging-app illusion.
    const compY = c.h - c.pad - 22;
    nodes.push(
      { kind: "rect", x: cb.x, y: compY - 24, w: cb.w - 66, h: 54, r: 27, fill: withAlpha(c.pal.fg, 0.1) },
      fixedBlock(c, c.slide.note ?? (c.index < c.total - 1 ? "Swipe for the next one…" : "Save this for later"), {
        x: cb.x + 24,
        y: compY - 9,
        w: cb.w - 120,
        size: 21,
        font: c.fonts.sans,
        weight: 400,
        color: c.pal.muted,
        marks: {},
      }).node,
      { kind: "ellipse", cx: cb.x + cb.w - 24, cy: compY + 3, rx: 27, ry: 27, fill: c.pal.accent },
      D.arrow(cb.x + cb.w - 38, compY + 3, 28, c.pal.dark ? "#04121f" : "#ffffff", 2.5),
    );
    return scene(c, c.pal.bg, nodes);
  },
};
