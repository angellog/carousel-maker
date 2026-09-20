/**
 * The Art Director.
 *
 * Turns a raw topic (plus optional audience and source material) into a
 * complete, opinionated art direction: which template to render through, which
 * palette to dress it in, how many slides, and the voice to write it in.
 *
 * The whole module is deterministic and pure — the same input always yields
 * the same output. There is no `Math.random`, no `Date.now`, and no I/O. Every
 * pick is guarded against the real preset and palette registries so the result
 * can never name something that does not exist.
 */

import { PRESETS, PRESET_BY_ID, type Preset } from "../presets";
import { PALETTE_BY_ID } from "../theme";

/** The shape a deck's copy takes. Drives template, voice and length. */
export type DeckFormat =
  | "list"
  | "how-to"
  | "comparison"
  | "data"
  | "myth-bust"
  | "story"
  | "quote"
  | "deep-dive";

/** A complete, self-consistent art direction for one deck. */
export interface ArtDirection {
  /** One of the real preset ids from PRESETS. */
  presetId: string;
  /** One of the real palette ids from PALETTES. */
  paletteId: string;
  /** Slide count, always inside the chosen preset's slideRange. */
  slideCount: number;
  format: DeckFormat;
  /** One of the TONES strings. */
  tone: string;
  /** One of the VOICES ids. */
  voiceId: VoiceId;
  /** 2-4 short human sentences explaining the picks. No em dashes. */
  reasons: string[];
}

export interface DirectorInput {
  topic: string;
  audience?: string;
  material?: string;
  /** User hint; respected when inside the chosen preset's range, else clamped. */
  slideCount?: number;
}

/** The exact tone strings the writer understands. */
export const TONES = [
  "Direct and practical",
  "Warm and personal",
  "Contrarian",
  "Analytical",
  "Playful",
] as const;
export type Tone = (typeof TONES)[number];

export type VoiceId = "straight" | "mentor" | "contrarian" | "analyst" | "hype";

/* ------------------------------- registries ------------------------------- */

/** The safe fallback when nothing else fits: a bold single-idea Keynote. */
const FALLBACK_PRESET_ID = "keynote";

/** Each format's home template (all ids verified against PRESETS below). */
const FORMAT_PRESET: Record<DeckFormat, string> = {
  comparison: "compare",
  "how-to": "timeline",
  list: "numberlist",
  data: "statlist",
  "myth-bust": "keynote",
  story: "editorial",
  quote: "quote",
  "deep-dive": "essay",
};

/** Default slide count per format, before clamping to the preset range. */
const FORMAT_SLIDES: Record<DeckFormat, number> = {
  list: 8,
  "how-to": 8,
  comparison: 6,
  data: 7,
  "myth-bust": 7,
  story: 9,
  "deep-dive": 9,
  quote: 6,
};

/** Human label used when writing the reasons. */
const FORMAT_LABEL: Record<DeckFormat, string> = {
  list: "List",
  "how-to": "How-to",
  comparison: "Comparison",
  data: "Data",
  "myth-bust": "Myth-busting",
  story: "Story",
  quote: "Quote",
  "deep-dive": "Deep-dive",
};

type Domain = "tech" | "finance" | "health" | "design" | "education" | "bold";

/** Palette leans per domain, in priority order. */
const DOMAIN_PALETTES: Record<Domain, string[]> = {
  tech: ["terminal", "blueprint", "electric", "midnight", "highlighter"],
  finance: ["slate", "midnight", "blueprint", "ink"],
  health: ["forest", "clay", "parchment", "paper"],
  design: ["sunset", "lavender", "candy", "electric"],
  education: ["notebook", "paper", "slate"],
  bold: ["amber", "electric", "candy"],
};

const DOMAIN_LABEL: Record<Domain, string> = {
  tech: "tech",
  finance: "finance",
  health: "health",
  design: "design",
  education: "learning",
  bold: "launch",
};

/** Keyword sets per domain. Checked in this array's order (first wins). */
const DOMAIN_TERMS: [Domain, string[]][] = [
  [
    "tech",
    [
      "ai", "artificial intelligence", "machine learning", "ml", "dev",
      "developer", "developers", "code", "coding", "software", "startup",
      "startups", "saas", "api", "apis", "programming", "tech", "technology",
      "cloud", "cyber", "cybersecurity", "llm", "llms", "gpt", "app", "apps",
      "engineering", "data science", "devops", "frontend", "backend",
    ],
  ],
  [
    "finance",
    [
      "finance", "financial", "money", "invest", "investing", "investment",
      "investments", "stock", "stocks", "crypto", "cryptocurrency", "market",
      "markets", "revenue", "profit", "business", "pricing", "budget",
      "budgeting", "economy", "economics", "roi", "fintech", "banking",
      "wealth", "savings", "tax", "taxes",
    ],
  ],
  [
    "health",
    [
      "health", "healthy", "wellness", "fitness", "workout", "workouts",
      "gym", "nutrition", "diet", "food", "recipe", "recipes", "sleep",
      "mental health", "nature", "hiking", "outdoors", "running", "yoga",
      "meditation", "calories", "protein",
    ],
  ],
  [
    "design",
    [
      "design", "designer", "creative", "art", "artist", "writing", "writer",
      "typography", "ux", "ui", "branding", "brand", "illustration",
      "photography", "music", "film", "fonts", "colour", "color",
    ],
  ],
  [
    "bold",
    [
      "launch", "launching", "sale", "discount", "announcement", "announcing",
      "hype", "deal", "deals", "release", "releasing", "black friday",
      "giveaway", "limited", "new drop", "promo", "offer",
    ],
  ],
  [
    "education",
    [
      "education", "study", "studying", "learn", "learning", "course",
      "courses", "teaching", "teacher", "student", "students", "exam",
      "exams", "notes", "habit", "habits", "productivity", "focus",
      "time management",
    ],
  ],
];

/* --------------------------------- helpers -------------------------------- */

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive, word-boundary match of any term in `hay`. */
function anyMatch(hay: string, terms: string[]): boolean {
  return terms.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`).test(hay));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Resolve a preset id to a real preset, falling back safely. */
function safePreset(id: string): Preset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get(FALLBACK_PRESET_ID) ?? PRESETS[0];
}

/** Resolve a palette id, falling back to the preset default then to any real id. */
function safePaletteId(id: string, preset: Preset): string {
  if (PALETTE_BY_ID.has(id)) return id;
  if (PALETTE_BY_ID.has(preset.defaultPalette)) return preset.defaultPalette;
  const first = PALETTE_BY_ID.keys().next().value;
  return first ?? preset.defaultPalette;
}

function paletteName(id: string): string {
  return PALETTE_BY_ID.get(id)?.name ?? id;
}

/** Lowercase, single-spaced haystack built from the topic and any material. */
function haystack(topic: string, material?: string): string {
  return `${topic} ${material ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

/** True when the topic carries no usable letters or digits. */
function isGarbage(topic: string): boolean {
  return !/[\p{L}\p{N}]/u.test(topic ?? "");
}

/* ------------------------------ format detect ----------------------------- */

const LIST_NOUNS =
  "things|ways|tips|mistakes|lessons|reasons|rules|habits|tools|tricks|hacks|" +
  "signs|traits|examples|ideas|secrets|questions|books|apps|frameworks|" +
  "principles|prompts|templates|features|skills|reads|myths|stats";
const LIST_RE = new RegExp(`\\b\\d{1,3}\\s+(?:${LIST_NOUNS})\\b`);
const TOP_N_RE = /\btop\s+\d{1,3}\b/;

/**
 * Classify a topic into a {@link DeckFormat}. Pure and case-insensitive; higher
 * rules win, and an unclassifiable topic is treated as an explainer
 * ("deep-dive"). The genuinely empty or garbage case is handled by
 * {@link directDeck}, not here.
 */
export function detectFormat(topic: string, material?: string): DeckFormat {
  const hay = haystack(topic, material);

  // 1. Comparison — vs / versus / "or" / compared / better than.
  if (anyMatch(hay, ["vs", "versus", "compared", "comparison", "better than", "which is better", "or"])) {
    return "comparison";
  }

  // 2. How-to — steps and instructions.
  if (
    anyMatch(hay, ["how to", "guide", "guides", "tutorial", "tutorials", "step by step", "step-by-step", "ways to", "walkthrough", "steps"])
  ) {
    return "how-to";
  }

  // 3. Myth-bust — corrects a belief.
  if (
    anyMatch(hay, [
      "myth", "myths", "misconception", "misconceptions", "debunk", "debunked",
      "debunking", "truth about", "you've been told", "you have been told",
      "stop believing", "lies about", "myth-busting",
    ])
  ) {
    return "myth-bust";
  }

  // 4. Quote — collected lines and sayings.
  if (anyMatch(hay, ["quote", "quotes", "sayings", "words on", "advice from", "wisdom of", "wisdom from", "aphorisms", "quotable"])) {
    return "quote";
  }

  // 5. Data — stats, numbers, market figures.
  if (
    hay.includes("%") ||
    anyMatch(hay, [
      "stats", "statistics", "numbers", "by the numbers", "market",
      "market size", "growth", "report", "study", "studies", "benchmark",
      "benchmarks", "data", "metrics", "survey", "percent",
    ])
  ) {
    return "data";
  }

  // 6. List — a numbered listicle.
  if (LIST_RE.test(hay) || TOP_N_RE.test(hay) || anyMatch(hay, ["listicle"])) {
    return "list";
  }

  // 7. Story — first-person narrative.
  if (
    anyMatch(hay, [
      "my journey", "how i", "i built", "i made", "i quit", "i grew",
      "i learned", "lessons from", "lessons i", "my story", "story of",
      "what i learned", "behind the scenes", "my experience",
    ])
  ) {
    return "story";
  }

  // 8. Deep-dive — explainer / long-form. Also the neutral default.
  return "deep-dive";
}

/* --------------------------------- domain --------------------------------- */

function detectDomain(hay: string): Domain | null {
  for (const [domain, terms] of DOMAIN_TERMS) {
    if (anyMatch(hay, terms)) return domain;
  }
  return null;
}

function detectPlayful(hay: string): boolean {
  return anyMatch(hay, [
    "fun", "playful", "pop culture", "meme", "memes", "quiz", "trivia",
    "silly", "quirky", "hot takes", "for fun", "party", "goofy", "wholesome",
  ]);
}

function detectReference(hay: string): boolean {
  return anyMatch(hay, [
    "cheatsheet", "cheat sheet", "cheat-sheet", "reference", "shortcuts",
    "keyboard shortcuts", "commands", "glossary", "checklist",
  ]);
}

function detectBigNumber(hay: string): boolean {
  return /\$\s?\d/.test(hay) || anyMatch(hay, ["one number", "the number", "roi", "revenue", "arr", "mrr", "cac", "ltv", "one metric", "single metric", "one stat"]);
}

function detectOverview(hay: string): boolean {
  return anyMatch(hay, [
    "overview", "agenda", "table of contents", "roadmap", "curriculum",
    "syllabus", "what to expect", "whats inside", "what's inside", "outline",
  ]);
}

/* ---------------------------------- voice --------------------------------- */

interface VoicePick {
  voiceId: VoiceId;
  tone: Tone;
}

function pickVoice(format: DeckFormat, playful: boolean): VoicePick {
  if (playful) return { voiceId: "hype", tone: "Playful" };
  switch (format) {
    case "myth-bust":
    case "comparison":
      return { voiceId: "contrarian", tone: "Contrarian" };
    case "data":
    case "deep-dive":
      return { voiceId: "analyst", tone: "Analytical" };
    case "story":
    case "quote":
      return { voiceId: "mentor", tone: "Warm and personal" };
    case "list":
    case "how-to":
    default:
      return { voiceId: "straight", tone: "Direct and practical" };
  }
}

const VOICE_REASON: Record<VoiceId, string> = {
  contrarian: "A contrarian voice to challenge the default view.",
  analyst: "An analyst voice to keep it evidence led.",
  mentor: "A mentor voice, warm and personal.",
  straight: "A straight voice, direct and practical.",
  hype: "A high energy voice to keep it playful.",
};

/* --------------------------------- palette -------------------------------- */

interface PalettePick {
  id: string;
  fromDomain: boolean;
}

/**
 * Prefer a domain-leaning palette that the preset was actually designed
 * against; otherwise keep the preset's own default so the look stays coherent.
 */
function pickPalette(preset: Preset, domain: Domain | null): PalettePick {
  if (domain) {
    for (const id of DOMAIN_PALETTES[domain]) {
      if (preset.palettes.includes(id) && PALETTE_BY_ID.has(id)) {
        return { id, fromDomain: true };
      }
    }
  }
  return { id: preset.defaultPalette, fromDomain: false };
}

/* --------------------------------- reasons -------------------------------- */

function formatReason(format: DeckFormat, preset: Preset): string {
  switch (preset.id) {
    case "colorpop":
      return "A light, playful topic, so the Colour Pop template fits.";
    case "contents":
      return "Reads like an overview, so the Contents template lays it out as an index.";
    case "cheatsheet":
      return "A reference style list, so the Cheatsheet template fits.";
    case "datacard":
      return "Built around one headline number, so the Data Card template fits.";
    default:
      return `${FORMAT_LABEL[format]} topic, so the ${preset.name} template fits.`;
  }
}

function paletteReason(pick: PalettePick, preset: Preset, domain: Domain | null): string {
  if (pick.fromDomain && domain) {
    return `${paletteName(pick.id)} palette leans into the ${DOMAIN_LABEL[domain]} subject.`;
  }
  return `${paletteName(pick.id)} is the ${preset.name} template's own palette, kept for a coherent look.`;
}

/* ---------------------------------- main ---------------------------------- */

/** The hand-built direction returned for an empty or garbage topic. */
function fallbackDirection(): ArtDirection {
  const preset = safePreset(FALLBACK_PRESET_ID);
  const [lo, hi] = preset.slideRange;
  const paletteId = safePaletteId(preset.defaultPalette, preset);
  return {
    presetId: preset.id,
    paletteId,
    slideCount: clamp(8, lo, hi),
    format: "deep-dive",
    tone: "Direct and practical",
    voiceId: "straight",
    reasons: [
      "No readable topic was given, so this is a safe default.",
      `The ${preset.name} template gives a bold single idea hook that fits almost anything.`,
      `${paletteName(paletteId)} is a clean, high contrast palette.`,
    ],
  };
}

/**
 * Direct a deck: choose the template, palette, length, format and voice for a
 * topic, and explain the choices. Deterministic and pure.
 */
export function directDeck(input: DirectorInput): ArtDirection {
  const topic = input.topic ?? "";
  if (isGarbage(topic)) return fallbackDirection();

  const hay = haystack(topic, input.material);
  const format = detectFormat(topic, input.material);
  const domain = detectDomain(hay);
  const playful = detectPlayful(hay);

  // Base template from the format, then opinionated overrides.
  let presetId = FORMAT_PRESET[format];
  if (format === "data" && detectBigNumber(hay)) presetId = "datacard";
  if (detectReference(hay)) presetId = "cheatsheet";
  if (detectOverview(hay)) presetId = "contents";
  if (playful) presetId = "colorpop";

  const preset = safePreset(presetId);
  const [lo, hi] = preset.slideRange;

  // Slide count: respect an in-range hint, clamp an out-of-range one, else derive.
  let slideCount: number;
  let clampedHint = false;
  const hint = input.slideCount;
  if (typeof hint === "number" && Number.isFinite(hint)) {
    const n = Math.round(hint);
    if (n >= lo && n <= hi) {
      slideCount = n;
    } else {
      slideCount = clamp(n, lo, hi);
      clampedHint = true;
    }
  } else {
    slideCount = clamp(FORMAT_SLIDES[format], lo, hi);
  }

  const palette = pickPalette(preset, domain);
  const paletteId = safePaletteId(palette.id, preset);
  const { voiceId, tone } = pickVoice(format, playful);

  const reasons = [
    formatReason(format, preset),
    paletteReason(palette, preset, domain),
    VOICE_REASON[voiceId],
  ];
  if (clampedHint) {
    reasons.push(`Clamped to ${slideCount} slides to fit the ${preset.name} template's ${lo} to ${hi} range.`);
  }

  return {
    presetId: preset.id,
    paletteId,
    slideCount,
    format,
    tone,
    voiceId,
    reasons,
  };
}
