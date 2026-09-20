import { z } from "zod";
import type { Deck, Slide } from "../types";
import { plain } from "../render/text";


/**
 * Models occasionally return a newline- or comma-separated string where the
 * schema asks for an array. That is a shape difference, not a content problem,
 * so coerce it rather than discarding an otherwise good deck.
 */
function splitLoose(v: string, alsoWhitespace = false): string[] {
  const trimmed = v.trim();
  if (!trimmed) return [];
  // Models sometimes stringify the array itself; parse it back rather than
  // splitting on commas and leaving quotes and brackets behind.
  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
    } catch {
      /* not valid JSON — fall through to the separator rules */
    }
  }
  const pieces = trimmed.includes("\n")
    ? trimmed.split("\n")
    : trimmed.includes(",")
      ? trimmed.split(",")
      : alsoWhitespace && /\s/.test(trimmed)
        ? trimmed.split(/\s+/)
        : [trimmed];
  return pieces.map(unquote).filter(Boolean);
}

/** Strip stray brackets and quotes left by a stringified array. */
function unquote(s: string): string {
  return s
    .trim()
    .replace(/^[[\]]+|[[\]]+$/g, "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
}

const stringArray = (alsoWhitespace = false) =>
  z.preprocess(
    (v) => (typeof v === "string" ? splitLoose(v, alsoWhitespace) : v),
    z.array(z.string()),
  );

/** Tolerate a single object where a list of objects is expected. */
const objectArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (v && !Array.isArray(v) && typeof v === "object" ? [v] : v), z.array(item));

export const slideSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["cover", "body", "cta"]).optional(),
  kicker: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  bullets: stringArray().optional(),
  stat: z
    .object({ value: z.string(), label: z.string(), delta: z.string().optional() })
    .optional(),
  quote: z
    .object({ text: z.string(), author: z.string(), role: z.string().optional() })
    .optional(),
  steps: objectArray(z.object({ label: z.string(), text: z.string() })).optional(),
  compare: z
    .object({
      leftLabel: z.string(),
      leftItems: stringArray(),
      rightLabel: z.string(),
      rightItems: stringArray(),
    })
    .optional(),
  chat: objectArray(z.object({ from: z.enum(["them", "me"]), text: z.string() })).optional(),
  code: z.object({ lang: z.string().default("text"), lines: stringArray() }).optional(),
  items: objectArray(z.object({ label: z.string(), value: z.string() })).optional(),
  table: z
    .object({ columns: stringArray(), rows: z.array(stringArray()) })
    .optional(),
  panels: objectArray(
    z.object({ title: z.string(), items: stringArray() }),
  ).optional(),
  ranked: objectArray(
    z.object({ label: z.string(), value: z.string().optional(), note: z.string().optional() }),
  ).optional(),
  note: z.string().optional(),
});

export const deckSchema = z.object({
  topic: z.string(),
  angle: z.string(),
  audience: z.string(),
  handle: z.string().optional(),
  slides: objectArray(slideSchema).pipe(z.array(slideSchema).min(3)),
  caption: z.string().optional(),
  hashtags: stringArray(true).optional(),
  sources: objectArray(z.object({ title: z.string(), url: z.string() })).optional(),
});

export type RawDeck = z.infer<typeof deckSchema>;

/** Readability budget, from the carousel-maker skill's rules. */
export const MAX_TITLE_WORDS = 15;
export const IDEAL_TITLE_WORDS = 12;

export function wordCount(s: string): number {
  return plain(s).trim().split(/\s+/).filter(Boolean).length;
}

/** Trim a string to a word budget without cutting mid-markup. */
export function clampWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/);
  if (words.length <= max) return s;
  let out = words.slice(0, max).join(" ");
  // Re-close any markup left dangling by the cut.
  for (const marker of ["**", "==", "__", "~~"]) {
    const n = out.split(marker).length - 1;
    if (n % 2 === 1) out += marker;
  }
  return out.replace(/[,;:]$/, "");
}

/** `#My Tag!` → `#mytag`. Returns null when nothing usable is left. */
/**
 * Models sometimes double-escape newlines, so a caption arrives containing a
 * literal backslash-n instead of a line break. Convert those back; leave a
 * genuine escaped backslash (`\\n`) alone.
 */
export function unescapeText(s: string): string {
  // Protect genuine escaped backslashes with a sentinel first, so a real
  // escaped backslash survives while a double-escaped newline is restored.
  return s
    .replace(/\\\\/g, "\u0000")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\u0000/g, "\\");
}

const NUM_WORDS: Record<string, string> = {
  two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
};

/**
 * Digits read sharper than number-words on a slide ("3 ways", not "three ways").
 * "one" is deliberately left alone — "1 of the" / "no 1" read worse than the word.
 */
export function numberWordsToDigits(s: string): string {
  return s.replace(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, (m) => NUM_WORDS[m.toLowerCase()]);
}

export function normalizeHashtag(raw: string): string | null {
  const body = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return body ? `#${body.toLowerCase()}` : null;
}

export interface DeckIssue {
  slide: number;
  field: string;
  message: string;
}

/**
 * Coerce arbitrary (model or user) input into a Deck that every preset can
 * render: stable ids, assigned roles, enforced word budgets, no empty arrays.
 */
export function normalizeDeck(
  raw: RawDeck,
  fallback: { handle: string; topic: string },
): { deck: Deck; issues: DeckIssue[] } {
  const issues: DeckIssue[] = [];
  const slides: Slide[] = raw.slides.map((s, i) => {
    const isFirst = i === 0;
    const isLast = i === raw.slides.length - 1;
    const role = s.role ?? (isFirst ? "cover" : isLast ? "cta" : "body");
    let title = numberWordsToDigits(unescapeText(s.title ?? "").trim()) || fallback.topic;
    if (wordCount(title) > MAX_TITLE_WORDS) {
      issues.push({ slide: i, field: "title", message: `Title over ${MAX_TITLE_WORDS} words; trimmed.` });
      title = clampWords(title, MAX_TITLE_WORDS);
    }
    const bullets = s.bullets?.map((b) => unescapeText(b).trim()).filter(Boolean);
    const out: Slide = {
      id: s.id || `s${i + 1}`,
      role,
      title,
      kicker: s.kicker ? unescapeText(s.kicker).trim() || undefined : undefined,
      body: s.body ? numberWordsToDigits(unescapeText(s.body).trim()) || undefined : undefined,
      bullets: bullets?.length ? bullets : undefined,
      stat: s.stat,
      quote: s.quote,
      steps: s.steps?.length ? s.steps : undefined,
      compare: s.compare,
      chat: s.chat?.length ? s.chat : undefined,
      code: s.code?.lines.length ? s.code : undefined,
      items: s.items?.length ? s.items : undefined,
      table: s.table?.rows.length ? s.table : undefined,
      panels: s.panels?.length ? s.panels : undefined,
      ranked: s.ranked?.length ? s.ranked : undefined,
      note: s.note ? unescapeText(s.note).trim() || undefined : undefined,
    };
    return out;
  });

  const deck: Deck = {
    topic: raw.topic?.trim() || fallback.topic,
    angle: raw.angle?.trim() || raw.topic,
    audience: raw.audience?.trim() || "anyone curious about this",
    handle: (raw.handle || fallback.handle || "").trim(),
    slides,
    caption: raw.caption ? unescapeText(raw.caption).trim() : "",
    hashtags: (raw.hashtags ?? [])
      .map(normalizeHashtag)
      .filter((h): h is string => !!h)
      .filter((h, i, a) => a.indexOf(h) === i)
      .slice(0, 12),
    sources: raw.sources ?? [],
  };
  return { deck, issues };
}

/** Fields a preset asked for but the deck never supplied. */
export function missingFields(deck: Deck, needs: string[]): string[] {
  const body = deck.slides.filter((s) => s.role === "body");
  if (body.length === 0) return [];
  return needs.filter((f) => !body.some((s) => (s as unknown as Record<string, unknown>)[f] != null));
}
