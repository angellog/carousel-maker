/**
 * Core content + preset model.
 *
 * A Deck is preset-agnostic content. A Preset turns a Deck slide into a Scene
 * (a flat, absolutely-positioned display list) which the canvas painter draws.
 * Nothing in this pipeline requires an image-generation model: every pixel is
 * produced from vectors, text and procedural texture.
 */

export type SlideRole = "cover" | "body" | "cta";

/** A statistic highlighted on a slide. */
export interface SlideStat {
  value: string;
  label: string;
  /** e.g. "+38%" or "-2.4x"; rendered as a delta chip when present. */
  delta?: string;
}

export interface SlideQuote {
  text: string;
  author: string;
  role?: string;
}

export interface SlideStep {
  label: string;
  text: string;
}

export interface SlideCompare {
  leftLabel: string;
  leftItems: string[];
  rightLabel: string;
  rightItems: string[];
}

export interface ChatTurn {
  from: "them" | "me";
  text: string;
}

export interface SlideCode {
  lang: string;
  lines: string[];
}

export interface SlideItem {
  label: string;
  value: string;
}

/** A real data table: a header row plus body rows. */
export interface SlideTable {
  columns: string[];
  rows: string[][];
}

/** A titled group of short lines — drawn as a bordered panel. */
export interface SlidePanel {
  title: string;
  items: string[];
}

/** One entry in a ranked list or leaderboard. */
export interface SlideRanked {
  label: string;
  /** The figure shown large on the right, e.g. "92%" or "US$ 29.5 B". */
  value?: string;
  /** Optional second line under the label. */
  note?: string;
}

/**
 * One slide's content. Every field beyond `title` is optional: presets declare
 * which fields they consume (`Preset.needs`) and degrade gracefully when a
 * field is missing, so any Deck can be re-rendered through any preset.
 *
 * Text fields accept inline markup: `**accent**`, `==highlight==`, `__underline__`.
 */
export interface Slide {
  id: string;
  role: SlideRole;
  /** Small label above the headline ("STEP 02", "MYTH"). */
  kicker?: string;
  title: string;
  body?: string;
  bullets?: string[];
  stat?: SlideStat;
  quote?: SlideQuote;
  steps?: SlideStep[];
  compare?: SlideCompare;
  chat?: ChatTurn[];
  code?: SlideCode;
  items?: SlideItem[];
  table?: SlideTable;
  panels?: SlidePanel[];
  ranked?: SlideRanked[];
  /** Small print at the bottom of the slide. */
  note?: string;
}

export interface Deck {
  /** Raw user topic. */
  topic: string;
  /** The specific point of view the deck argues. */
  angle: string;
  audience: string;
  handle: string;
  slides: Slide[];
  caption: string;
  hashtags: string[];
  /** Sources consulted during research, if any. */
  sources: { title: string; url: string }[];
  /** True when written by the built-in offline writer rather than the model. */
  offline?: boolean;
  /** True when the offline writer had real research to draw on (not placeholders). */
  enriched?: boolean;
}

/** Which optional Slide fields a preset actually renders. */
export type SlideField =
  | "kicker"
  | "body"
  | "bullets"
  | "stat"
  | "quote"
  | "steps"
  | "compare"
  | "chat"
  | "code"
  | "items"
  | "table"
  | "panels"
  | "ranked"
  | "note";

export type PresetCategory =
  | "editorial"
  | "minimal"
  | "data"
  | "playful"
  | "technical"
  | "bold";

export interface Palette {
  id: string;
  name: string;
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  surface: string;
  line: string;
  /** true when bg is dark — used to pick shadows and overlays. */
  dark: boolean;
}
