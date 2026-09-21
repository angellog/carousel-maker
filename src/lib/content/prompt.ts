import type { Preset } from "../presets/types";
import type { SlideField } from "../types";
import { voiceSystemPrompt } from "./voice";

export interface GenerateInput {
  topic: string;
  audience?: string;
  handle?: string;
  tone?: string;
  /** Writer persona id (see ./voice). Sets the register of the copy. */
  voiceId?: string;
  slideCount: number;
  presetId: string;
  research: boolean;
  /** Which keyless research source to use when the writer can't search itself. */
  researchSource?: "wikipedia" | "web";
  /** Optional source material the user pasted (transcript, notes, article). */
  material?: string;
  /**
   * A key supplied by the client for this request only. Never persisted, never
   * logged, and never included in any response.
   */
  apiKey?: string;
}

const FIELD_GUIDE: Record<SlideField, string> = {
  kicker: "`kicker` — a 1–4 word label above the headline.",
  body: "`body` — one or two short sentences under the headline.",
  bullets: "`bullets` — 3–5 short phrases, each under 12 words.",
  stat: "`stat` — `{value, label, delta?}`. `value` is short and typographic ('3.2×', '71%', '$4,800').",
  quote: "`quote` — `{text, author, role?}`. A line worth screenshotting, 8–24 words.",
  steps: "`steps` — 3–5 `{label, text}` stages that read as a progression.",
  compare: "`compare` — `{leftLabel, leftItems, rightLabel, rightItems}`, 3–4 short items per side.",
  chat: "`chat` — 2–4 `{from: 'them'|'me', text}` turns; 'them' raises the real objection, 'me' answers it.",
  code: "`code` — `{lang, lines}`; a copy-pasteable prompt, command or snippet in 3–8 short lines.",
  items: "`items` — 5–8 `{label, value}` reference rows; `label` under 24 characters.",
  table: "`table` — `{columns, rows}`. 2–4 columns, 3–6 rows. Every cell under 18 characters; this is a comparison grid, not prose.",
  panels: "`panels` — 2–4 `{title, items}` groups; `title` is 1–3 words, each `items` entry under 8 words.",
  ranked: "`ranked` — 4–7 `{label, value?, note?}` entries in rank order. `label` is 1–3 words, `value` is a short figure ('92%', '$4.8B').",
  note: "`note` — one short line of small print or a takeaway.",
};

export function buildSystemPrompt(preset: Preset, input: GenerateInput): string {
  return [
    "You write Instagram carousels that people save and send to a friend.",
    "",
    "## Non-negotiable readability rules",
    "- One idea per slide. If a headline needs a comma to hold two ideas, split the slide.",
    "- Headlines: 3–8 words, and each must work as a standalone screenshot. Never more than 12.",
    "- No paragraphs anywhere. Short lines only. Max 3 bullets per slide, one line each.",
    "- Write numbers as digits: '3 ways', not 'three ways'; '40%', not 'forty percent'.",
    "- Every body slide ends on an open loop — a reason to swipe to the next.",
    "- Slide 1 is the thumbnail; if it wouldn't stop the scroll, rewrite it.",
    "- No emoji in headlines. At most one emoji per deck, and only if it genuinely helps.",
    "- Write in plain, concrete language. Prefer a specific noun over an abstract one.",
    "",
    "## Banned language (never use)",
    "- 'In today's world', 'It's no secret', 'Let's dive in', 'elevate your', 'game-changer',",
    "  'must-have', 'you need this', 'unlock', 'supercharge', and any fake urgency or scarcity.",
    "",
    "## Inline markup",
    "Use sparingly inside any text field:",
    "- `**word**` marks the one word or phrase that carries the idea (rendered in the accent colour).",
    "- `==word==` applies a marker highlight.",
    "- `__word__` underlines. `~~word~~` strikes through.",
    "Mark at most **one** span per slide — the single word that carries the idea. One accent, not a scatter.",
    "",
    voiceSystemPrompt(input.voiceId),
    "",
    `## The chosen template: ${preset.name}`,
    preset.blurb,
    "",
    preset.brief,
    "",
    "This template renders these fields, so populate them on every body slide:",
    ...preset.needs.map((f) => `- ${FIELD_GUIDE[f]}`),
    "Fields not listed above are ignored by this template — omit them.",
    "",
    "## Deck shape",
    `- Exactly ${input.slideCount} slides.`,
    "- Slide 1 is `role: \"cover\"` — the hook. It must make a specific promise, not a vague one.",
    "- The last slide is `role: \"cta\"` — one clear action. No hard sell.",
    "- Everything between is `role: \"body\"`.",
    "- Body slides must escalate: each one should be a reason to keep swiping.",
    "",
    "## Honesty",
    "- Only state a statistic if you actually found it in a search result, and put the source in `sources`.",
    "- If you did not verify a number, do not invent one — make the point qualitatively instead.",
    "- A `stat` with no sourced number carries a short label instead ('BIGGEST FACTOR', 'MOST COMMON'), never a made-up figure.",
    "- Attribute quotes only to people who actually said them. Otherwise write the line unattributed in `body`.",
    "",
    "Call the `submit_deck` tool exactly once with the finished deck. Do not write prose replies.",
  ].join("\n");
}

export interface UserPromptOptions {
  /**
   * Pre-gathered facts from a keyless researcher. Used for writers that cannot
   * search the web themselves (open-source models): the facts are handed over
   * as grounding, and the model is told to write from them and cite the sources
   * rather than inventing anything.
   */
  facts?: string[];
  sources?: { title: string; url: string }[];
}

export function buildUserPrompt(input: GenerateInput, opts: UserPromptOptions = {}): string {
  const lines = [`Topic: ${input.topic}`];
  if (input.audience) lines.push(`Audience: ${input.audience}`);
  if (input.tone) lines.push(`Tone: ${input.tone}`);
  if (input.handle) lines.push(`Handle to credit: ${input.handle}`);
  lines.push(`Slides: ${input.slideCount}`);
  if (input.material) {
    lines.push("", "Source material to draw from (prefer this over general knowledge):", "---", input.material.slice(0, 20000), "---");
  }
  if (opts.facts && opts.facts.length > 0) {
    lines.push(
      "",
      "Some facts gathered from public sources are below. They can be incomplete or, occasionally, off-topic (keyless search sometimes returns an unrelated article). Use your judgement: build on the ones genuinely about this topic, ignore any that are not, and use your own knowledge to fill the gaps. Do not invent specific statistics the facts don't support.",
      ...opts.facts.slice(0, 40).map((f) => `- ${f}`),
    );
    if (opts.sources && opts.sources.length > 0) {
      lines.push(
        "",
        "These are the sources those facts came from. Put a source in the deck's `sources` field ONLY if you actually used a fact from it. Never cite a source you did not use — if you wrote from your own knowledge, leave `sources` empty.",
        ...opts.sources.map((s) => `- ${s.title} — ${s.url}`),
      );
    }
    lines.push("", "Write the deck now. Do not claim to have searched; use the facts above where they fit and your own knowledge for the rest.");
    return lines.join("\n");
  }
  if (input.research) {
    lines.push(
      "",
      "Before writing, search the web for what is actually true and current about this topic:",
      "specific numbers, recent changes, common failure modes, and the strongest counter-argument.",
      "Run two to four focused searches. Then write the deck.",
    );
  } else {
    lines.push("", "Do not search. Write from what you already know, and stay qualitative rather than inventing figures.");
  }
  return lines.join("\n");
}

/** JSON Schema for the `submit_deck` tool. */
export const DECK_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    topic: { type: "string" },
    angle: { type: "string", description: "The specific point of view this deck argues, in one line." },
    audience: { type: "string" },
    caption: { type: "string", description: "The Instagram caption. 2–5 short paragraphs, ending with the CTA." },
    hashtags: { type: "array", items: { type: "string" }, description: "6–12 hashtags, no # prefix needed." },
    sources: {
      type: "array",
      description: "Only sources actually consulted via search.",
      items: {
        type: "object",
        properties: { title: { type: "string" }, url: { type: "string" } },
        required: ["title", "url"],
      },
    },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          role: { type: "string", enum: ["cover", "body", "cta"] },
          kicker: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
          stat: {
            type: "object",
            properties: { value: { type: "string" }, label: { type: "string" }, delta: { type: "string" } },
            required: ["value", "label"],
          },
          quote: {
            type: "object",
            properties: { text: { type: "string" }, author: { type: "string" }, role: { type: "string" } },
            required: ["text", "author"],
          },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, text: { type: "string" } },
              required: ["label", "text"],
            },
          },
          compare: {
            type: "object",
            properties: {
              leftLabel: { type: "string" },
              leftItems: { type: "array", items: { type: "string" } },
              rightLabel: { type: "string" },
              rightItems: { type: "array", items: { type: "string" } },
            },
            required: ["leftLabel", "leftItems", "rightLabel", "rightItems"],
          },
          chat: {
            type: "array",
            items: {
              type: "object",
              properties: { from: { type: "string", enum: ["them", "me"] }, text: { type: "string" } },
              required: ["from", "text"],
            },
          },
          code: {
            type: "object",
            properties: { lang: { type: "string" }, lines: { type: "array", items: { type: "string" } } },
            required: ["lang", "lines"],
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { label: { type: "string" }, value: { type: "string" } },
              required: ["label", "value"],
            },
          },
          table: {
            type: "object",
            properties: {
              columns: { type: "array", items: { type: "string" } },
              rows: { type: "array", items: { type: "array", items: { type: "string" } } },
            },
            required: ["columns", "rows"],
          },
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                items: { type: "array", items: { type: "string" } },
              },
              required: ["title", "items"],
            },
          },
          ranked: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                note: { type: "string" },
              },
              required: ["label"],
            },
          },
          note: { type: "string" },
        },
        required: ["role", "title"],
      },
    },
  },
  required: ["topic", "angle", "audience", "slides", "caption", "hashtags"],
};
