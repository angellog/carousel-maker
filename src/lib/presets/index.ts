import { PREMIUM_PRESETS } from "./premium";
import { FUNCTIONAL_PRESETS } from "./functional";
import { TECHNICAL_PRESETS } from "./technical";
import { VIVID_PRESETS } from "./vivid";
import { PRESS_PRESETS } from "./press";
import { FUN_PRESETS } from "./fun";
import { ILLUSTRATED_PRESETS } from "./illustrated";
import type { Preset } from "./types";

/**
 * The shipped templates — 30 distinct design systems, each drawn entirely from
 * vectors, type and canvas decor (no image models). Grouped by family:
 *
 *   premium      → swiss, magazine, whitepaper, manifesto   (editorial / statement)
 *   functional   → ledger, podium, versus, roadmap          (data / comparison / steps)
 *   technical    → blueprint, terminal, brutalist, spec      (technical / bold)
 *   vivid        → aurora, sticky, receipt, chalkboard        (playful / textured)
 *   press        → broadsheet, serifzine, minimalist, gradient (editorial / minimal / bold)
 *   fun          → memo, arcade, polaroid, doodle             (playful)
 *   illustrated  → notebook, editorial, stickerpop, infographic, storyboard, scrapbook
 *                                                            (hand-drawn / illustrative)
 *
 * PRESETS[0] is the safe fallback for an unknown id, so it leads with a clean,
 * universal template. The Art Director (`src/lib/director`) maps each content
 * format to the best template here.
 */
export const PRESETS: Preset[] = [
  ...PREMIUM_PRESETS,
  ...FUNCTIONAL_PRESETS,
  ...TECHNICAL_PRESETS,
  ...VIVID_PRESETS,
  ...PRESS_PRESETS,
  ...FUN_PRESETS,
  ...ILLUSTRATED_PRESETS,
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
