import type { Ctx } from "../render/ctx";
import { contentBox, fixedBlock, textWidth } from "../render/ctx";
import * as D from "../render/decor";
import * as G from "../render/diagrams";
import { iconFor } from "../render/icons";
import * as P from "../render/props";
import type { Node } from "../render/scene";
import { mix, withAlpha } from "../theme";
import type { SlidePanel, SlideRanked } from "../types";
import { bodyBox, coverScene, defaultShell, headStack, scene } from "./_shared";
import type { Preset } from "./types";

/** Fall back to bullets when the writer did not supply structured data. */
function asRanked(c: Ctx): SlideRanked[] {
  if (c.slide.ranked?.length) return c.slide.ranked;
  if (c.slide.items?.length) return c.slide.items.map((i) => ({ label: i.label, value: i.value }));
  return (c.slide.bullets ?? []).map((b) => ({ label: b }));
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
    if (c.slide.role === "cover") return coverScene(c);
    const cb = contentBox(c);
    const nodes: Node[] = [];
    const s = defaultShell(c, {
      titleMax: 66,
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

