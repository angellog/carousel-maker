import type { Deck, Slide, SlideField } from "../types";
import type { Preset } from "../presets/types";
import type { ResearchResult } from "./research";

/**
 * Deterministic writer used when no ANTHROPIC_API_KEY is configured.
 *
 * It produces a structurally complete, renderable deck so the whole pipeline
 * works offline — but it writes *scaffolding*, not researched claims. Anything
 * it cannot honestly know (statistics, quotes, sources) is emitted as an
 * obvious placeholder rather than an invented fact, and `deck.offline` is set
 * so the UI can say so plainly.
 */

const PLACEHOLDER_STAT = "00%";

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function shortTopic(topic: string, words = 5): string {
  return topic.trim().split(/\s+/).slice(0, words).join(" ");
}

interface Frame {
  kicker: (t: string, i: number) => string;
  title: (t: string, i: number) => string;
  body: (t: string, i: number) => string;
}

const FRAMES: Frame[] = [
  {
    kicker: () => "The problem",
    title: (t) => `Most advice about **${shortTopic(t, 3)}** starts in the wrong place`,
    body: (t) => `Before anything else, get clear on what you are actually trying to change about ${shortTopic(t, 6)}.`,
  },
  {
    kicker: () => "What changes",
    title: (t) => `The shift: from busy to **deliberate** with ${shortTopic(t, 3)}`,
    body: () => "Name the one outcome that matters this month. Everything else is optional.",
  },
  {
    kicker: () => "The method",
    title: () => "A repeatable loop you can run **every week**",
    body: () => "Small, scheduled, and boring beats ambitious and sporadic. Every time.",
  },
  {
    kicker: () => "The mistake",
    title: () => "Why the obvious approach **quietly fails**",
    body: (t) => `It optimises for effort spent on ${shortTopic(t, 4)}, not for the result you said you wanted.`,
  },
  {
    kicker: () => "The proof",
    title: () => "How you'll know it is **actually working**",
    body: () => "Pick one number you can check in under a minute. Track it weekly, not daily.",
  },
  {
    kicker: () => "The tools",
    title: () => "What you need — and what you **can skip**",
    body: () => "Almost every tool here is optional. The habit is not.",
  },
  {
    kicker: () => "The trade-off",
    title: () => "What this costs you, **honestly**",
    body: () => "There is a real price. Decide up front whether you are willing to pay it.",
  },
  {
    kicker: () => "Start here",
    title: () => "The smallest version you can do **today**",
    body: () => "Fifteen minutes. One decision. That is the entire first step.",
  },
];

const BULLET_SETS: ((t: string) => string[])[] = [
  (t) => [
    `Write down what "done" looks like for ${shortTopic(t, 3)}`,
    "Cut the list until only one item remains",
    "Put that item on the calendar this week",
  ],
  () => ["Pick the metric", "Set the review day", "Decide what you'll stop doing"],
  () => [
    "It compounds slowly, then all at once",
    "Consistency beats intensity",
    "Review beats planning",
  ],
  (t) => [`Audit your current ${shortTopic(t, 3)}`, "Remove one step", "Automate one step", "Repeat monthly"],
];

const ITEM_SETS: ((t: string) => { label: string; value: string }[])[] = [
  () => [
    { label: "Define", value: "One sentence, no jargon" },
    { label: "Measure", value: "One number, checked weekly" },
    { label: "Reduce", value: "Remove a step before adding one" },
    { label: "Review", value: "Same day every week" },
    { label: "Repeat", value: "For at least six weeks" },
  ],
];

/** Turn a research sentence into a short, slide-safe phrase. */
function toPhrase(sentence: string, max = 92): string {
  let s = sentence.replace(/\s*\([^)]*\)/g, "").trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return s.replace(/[.,;:]+$/, "");
}

function fieldsFor(preset: Preset, i: number, topic: string, slideCount: number): Partial<Slide> {
  const need = new Set<SlideField>(preset.needs);
  const out: Partial<Slide> = {};
  if (need.has("bullets")) out.bullets = BULLET_SETS[i % BULLET_SETS.length](topic);
  if (need.has("items")) out.items = ITEM_SETS[0](topic);
  if (need.has("stat")) {
    out.stat = {
      value: PLACEHOLDER_STAT,
      label: "Replace with a number you can source",
      delta: undefined,
    };
  }
  if (need.has("quote")) {
    out.quote = {
      text: "Write the line you would want screenshotted here.",
      author: "your name",
    };
  }
  if (need.has("steps")) {
    out.steps = [
      { label: "Decide", text: "Name the single outcome." },
      { label: "Shrink", text: "Cut it to a fifteen-minute version." },
      { label: "Schedule", text: "Put it on one fixed day." },
    ];
  }
  if (need.has("compare")) {
    out.compare = {
      leftLabel: "Most people",
      leftItems: ["Plan in detail", "Start on Monday", "Measure everything"],
      rightLabel: "Do this instead",
      rightItems: ["Decide in one line", "Start today", "Measure one thing"],
    };
  }
  if (need.has("chat")) {
    out.chat = [
      { from: "them", text: "But I've tried this before and it didn't stick." },
      { from: "me", text: "Because it was too big. Shrink it until it's boring." },
    ];
  }
  if (need.has("code")) {
    out.code = {
      lang: "prompt",
      lines: [
        `You are helping me with **${shortTopic(topic, 4)}**.`,
        "",
        "Ask me three questions before answering.",
        "Then give me one concrete next step.",
      ],
    };
  }
  if (need.has("table")) {
    out.table = {
      columns: ["Approach", "Effort", "Sticks?"],
      rows: [
        ["All at once", "High", "Rarely"],
        ["One habit", "Low", "Usually"],
        ["Nothing", "None", "Never"],
      ],
    };
  }
  if (need.has("panels")) {
    out.panels = [
      { title: "Do", items: ["Pick one outcome", "Shrink it", "Schedule it"] },
      { title: "Skip", items: ["New tools", "Perfect plans", "Daily tracking"] },
    ];
  }
  if (need.has("ranked")) {
    out.ranked = [
      { label: "Consistency", value: "—", note: "Replace with your own figure" },
      { label: "Clarity", value: "—" },
      { label: "Scheduling", value: "—" },
      { label: "Review", value: "—" },
      { label: "Intensity", value: "—" },
    ];
  }
  if (need.has("note")) out.note = i === slideCount - 2 ? "Save this before you swipe on." : "One idea per slide. That's the whole trick.";
  return out;
}

export function writeOfflineDeck(args: {
  topic: string;
  audience?: string;
  handle?: string;
  preset: Preset;
  slideCount: number;
  /** Real facts from keyless research; upgrades placeholders to sourced copy. */
  research?: ResearchResult;
}): Deck {
  const topic = args.topic.trim() || "your topic";
  const count = Math.max(4, Math.min(12, args.slideCount));
  const bodyCount = count - 2;
  const handle = (args.handle ?? "").trim();
  const audience = args.audience?.trim() || "people trying to get better at this";
  const research = args.research;
  const facts = research?.facts ?? [];
  // Enrich as soon as we have a few real facts, not one per body slide. Fact
  // yield varies run to run (a Wikipedia article can time out), and the old
  // `>= bodyCount` cliff flipped data-rich topics to a full placeholder deck
  // whenever a single article dropped. Leftover slots fall back to a topic-
  // anchored frame title with no body, so a partially-covered deck still reads
  // as intentional rather than reverting everything to scaffolding.
  const enriched = facts.length >= Math.min(bodyCount, 3);

  const slides: Slide[] = [];
  slides.push({
    id: "s1",
    role: "cover",
    kicker: "Read this first",
    title: enriched
      ? `${bodyCount} things worth knowing about **${titleCase(shortTopic(topic, 4))}**`
      : `${bodyCount} things about **${titleCase(shortTopic(topic, 4))}** worth knowing`,
    body:
      research?.lead && research.lead.length > 20
        ? toPhrase(research.lead, 150)
        : `A short, practical pass for ${audience}.`,
    note: "Swipe →",
  });

  for (let i = 0; i < bodyCount; i++) {
    const f = FRAMES[i % FRAMES.length];
    const fact = facts[i];
    slides.push({
      id: `s${i + 2}`,
      role: "body",
      kicker: enriched ? "Fact " + String(i + 1).padStart(2, "0") : f.kicker(topic, i),
      title: enriched && fact ? toPhrase(fact, 70) : f.title(topic, i),
      // When enriched, the body carries a second real fact if we have one;
      // otherwise leave it empty. A strong fact title standing alone reads as
      // intentional, whereas the generic FRAMES body ("Name the one outcome
      // that matters this month") clashes badly under a real researched claim.
      body: enriched
        ? facts[i + bodyCount]
          ? toPhrase(facts[i + bodyCount], 130)
          : undefined
        : f.body(topic, i),
      ...fieldsFor(args.preset, i, topic, count),
    });
  }

  slides.push({
    id: `s${count}`,
    role: "cta",
    kicker: "Your turn",
    title: "Pick **one** thing here and do it this week",
    body: handle ? `Follow ${handle} for more on ${shortTopic(topic, 4)}.` : "Save this so you can come back to it.",
    note: "Save · Share · Try it",
  });

  const tag = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  return {
    topic,
    angle: enriched
      ? research!.lead || `A practical take on ${shortTopic(topic, 6)}`
      : `A practical, non-obvious take on ${shortTopic(topic, 6)}`,
    audience,
    handle,
    slides,
    caption:
      `${titleCase(shortTopic(topic, 5))} — the short version.\n\n` +
      (enriched
        ? `Drafted from public sources (Wikipedia). Tighten the wording and add your own angle before you post.\n\n`
        : `This is a draft skeleton: swap in your own examples and numbers before you post.\n\n`) +
      (handle ? `More like this: ${handle}` : ""),
    hashtags: [...tag.map((t) => `#${t}`), "#carousel", "#howto"],
    sources: research?.sources ?? [],
    offline: true,
    enriched,
  };
}
