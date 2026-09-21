/**
 * Deck blueprints — the content arc of a carousel, independent of its visual
 * template.
 *
 * Extracted from the "famous IG carousel" editorial method (minus its image
 * generation, which this app deliberately does not use): the cover IS the hook,
 * every other slide delivers value, and there is no context slide, no transition
 * slide, and no filler. Each format gets a proven progression the writer follows.
 *
 * A blueprint is guidance handed to the copywriter (see ./prompt), not a schema.
 * The Art Director picks the format; the blueprint gives that format its spine.
 */

import type { DeckFormat } from "../director";

export interface Blueprint {
  id: DeckFormat;
  /** Human name for the arc, shown in the prompt. */
  name: string;
  /** One line on what this arc is for. */
  note: string;
  /**
   * The body-slide progression between the cover (always the hook) and the CTA
   * (always the ask). Each entry is one beat; the writer stretches or combines
   * them to fit the slide count, but keeps the order and the value-every-slide
   * shape.
   */
  arc: string[];
}

export const BLUEPRINTS: Record<DeckFormat, Blueprint> = {
  "how-to": {
    id: "how-to",
    name: "How-to spine",
    note: "A repeatable process the reader can act on.",
    arc: [
      "The setup: what to have or decide before starting",
      "The steps in order, one clear move per slide",
      "The mistake that quietly ruins it",
      "How to know it actually worked",
    ],
  },
  list: {
    id: "list",
    name: "Value spine",
    note: "A tight, save-worthy list where every item earns its slide.",
    arc: [
      "What this is and why it's worth the swipe",
      "The items, one strong pick per slide, best idea first",
      "The standout, or the one most people miss",
      "How to actually use them this week",
    ],
  },
  comparison: {
    id: "comparison",
    name: "Versus spine",
    note: "Two options, framed fairly, with a clear verdict.",
    arc: [
      "The two options, stated fairly with what each is for",
      "Head to head on the things that actually matter",
      "When each one wins (the honest trade-off)",
      "The verdict, and who should pick which",
    ],
  },
  data: {
    id: "data",
    name: "Number spine",
    note: "Sourced figures that change how the reader sees the topic.",
    arc: [
      "The headline number and why it's surprising",
      "The figures that back it, one sourced stat per slide",
      "What the data does NOT say (the honest caveat)",
      "What to do with it",
    ],
  },
  "myth-bust": {
    id: "myth-bust",
    name: "Myth spine",
    note: "Name the belief, flip it fairly, back the flip.",
    arc: [
      "State the common belief plainly, at its strongest",
      "The turn: why it's wrong or incomplete",
      "The evidence or mechanism behind the real answer",
      "What to do instead",
    ],
  },
  story: {
    id: "story",
    name: "Story spine",
    note: "A small arc with one concrete lesson.",
    arc: [
      "The before: the stuck point or the wrong assumption",
      "The turn: what changed and why",
      "The lesson, made concrete (not a platitude)",
      "The takeaway the reader can steal",
    ],
  },
  quote: {
    id: "quote",
    name: "Quote spine",
    note: "A line worth screenshotting, then made useful.",
    arc: [
      "The line that reframes the topic",
      "What it means in practice",
      "One example that proves it",
      "How to apply it today",
    ],
  },
  "deep-dive": {
    id: "deep-dive",
    name: "Explainer spine",
    note: "A complex idea made clear, layer by layer.",
    arc: [
      "The core idea in plain words",
      "How it actually works, one layer per slide",
      "The nuance most explanations skip",
      "Why it matters for the reader",
    ],
  },
};

export function blueprintFor(format: DeckFormat): Blueprint {
  return BLUEPRINTS[format] ?? BLUEPRINTS.list;
}

/** The blueprint section spliced into the writer's system prompt. */
export function blueprintSection(format: DeckFormat, slideCount: number): string {
  const b = blueprintFor(format);
  return [
    `## Deck arc: the ${b.name}`,
    "Slide 1 is the hook and the last slide is the CTA. The body escalates through this arc, and every slide delivers value: no context slide, no transition slide, no filler.",
    ...b.arc.map((beat) => `- ${beat}`),
    `Fit this arc to the ${slideCount} slides: stretch a beat across two slides or combine two beats into one, but keep the order and the cover-first, value-every-slide shape.`,
  ].join("\n");
}
