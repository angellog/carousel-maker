import { editorial, duotone, keynote, quoteCard, swiss } from "./editorial";
import { chalkboard, doodlemascot, notebook, papercollage, pastelnote } from "./handdrawn";
import { darkgrid, flatcolor, glasschips, promptcard, retro3d } from "./bold";
import { cheatsheet, flowchart, numberlist, schematic, timeline } from "./structured";
import { chatthread, compare, datacard, studiomin, warmserif } from "./clean";
import {
  architecture,
  bento,
  datatable,
  layerstack,
  mindmap,
  panels,
  processflow,
  ranking,
  spectrum,
  statlist,
} from "./dense";
import {
  colorpop,
  contents,
  corpgeo,
  dossier,
  essay,
  indexcover,
  notecard,
  rankcard,
  specsheet,
  studysheet,
} from "./covers";
import type { Preset } from "./types";

/**
 * The 45 shipped presets, in picker order.
 *
 * Ordering is deliberate: the formats that carry the most information per
 * slide come first, because a carousel that explains something well beats a
 * carousel that merely looks good. See docs/preset-research.md for the source
 * of each one.
 */
export const PRESETS: Preset[] = [
  // Information-dense first.
  statlist,
  keynote,
  numberlist,
  datatable,
  panels,
  processflow,
  cheatsheet,
  editorial,
  ranking,
  compare,
  bento,
  layerstack,
  contents,
  timeline,
  architecture,
  mindmap,
  spectrum,
  // Hand-drawn and study formats.
  notebook,
  studysheet,
  indexcover,
  chalkboard,
  colorpop,
  pastelnote,
  doodlemascot,
  papercollage,
  notecard,
  rankcard,
  dossier,
  // Editorial and minimal.
  essay,
  quoteCard,
  warmserif,
  studiomin,
  specsheet,
  swiss,
  corpgeo,
  duotone,
  // Bold and technical.
  flatcolor,
  retro3d,
  promptcard,
  glasschips,
  darkgrid,
  schematic,
  flowchart,
  datacard,
  chatthread,
];

export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

export function getPreset(id: string | undefined): Preset {
  return PRESET_BY_ID.get(id ?? "") ?? PRESETS[0];
}

export const CATEGORIES = [
  { id: "data", label: "Data" },
  { id: "editorial", label: "Editorial" },
  { id: "technical", label: "Technical" },
  { id: "playful", label: "Playful" },
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
] as const;

export type { Preset };
