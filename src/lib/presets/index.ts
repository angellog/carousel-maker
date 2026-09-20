import { editorial, keynote, quoteCard } from "./editorial";
import { cheatsheet, numberlist, timeline } from "./structured";
import { compare, datacard } from "./clean";
import { statlist } from "./dense";
import { colorpop, contents, essay } from "./covers";
import type { Preset } from "./types";

/**
 * The shipped presets, in picker order — a curated set of the carousel formats
 * that actually win (saves, shares, screenshots), one impeccable template per
 * format rather than a long tail of lookalikes:
 *
 *   - data / ranked list   → statlist, datacard   (the most-saved format)
 *   - bold statement / hook → keynote             (also one-big-number slides)
 *   - listicle / tips       → numberlist, cheatsheet
 *   - how-to / steps        → timeline
 *   - comparison / vs       → compare              (most comments + shares)
 *   - story / editorial      → editorial, essay, quoteCard, contents
 *   - playful               → colorpop
 *
 * Information-dense formats come first: a carousel that explains something well
 * beats one that merely looks good. See docs/preset-research.md.
 */
export const PRESETS: Preset[] = [
  // Data & lists.
  statlist,
  datacard,
  numberlist,
  cheatsheet,
  compare,
  timeline,
  contents,
  // Statement & editorial.
  keynote,
  editorial,
  essay,
  quoteCard,
  // Playful.
  colorpop,
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
