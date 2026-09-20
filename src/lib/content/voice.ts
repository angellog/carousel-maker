/**
 * Writer voices — the "personality" layer.
 *
 * A carousel that reads like every other carousel gets scrolled past. A voice
 * is a committed point of view on *how* the copy talks: sentence shape, diction,
 * what it leans into, what it refuses. Voices are additive to the non-negotiable
 * readability and honesty rules in `prompt.ts` — they change the register, never
 * the discipline (still digits, still one idea per slide, still no fabricated
 * stats, still no banned phrases).
 *
 * The Art Director (`../director`) auto-selects a voice from the topic; the user
 * can override it. The id set here is the contract the director targets.
 */

export type VoiceId = "straight" | "mentor" | "contrarian" | "analyst" | "hype";

export interface Voice {
  id: VoiceId;
  /** Display name in the picker. */
  name: string;
  /** One line the UI shows under the name. */
  blurb: string;
  /** The tone string this voice pairs with (matches the TONES list in the UI). */
  tone: string;
  /**
   * The instruction block appended to the system prompt. Concrete rules and one
   * before/after, because "be punchy" produces nothing and "verb-first, cut the
   * hedge" produces a voice.
   */
  guide: string[];
  /** How the caption's register shifts for this voice. */
  caption: string;
}

export const VOICES: Voice[] = [
  {
    id: "straight",
    name: "The Straight Shooter",
    blurb: "Plain, fast, no hedging. Says the thing.",
    tone: "Direct and practical",
    guide: [
      "Voice: the straight shooter. Plain, fast, useful.",
      "- Short declaratives. Lead with the verb or the noun that matters.",
      "- Cut every hedge: no 'might', 'could help', 'in many cases', 'generally'.",
      "- Prefer an imperative on how-to slides: 'Do X. Skip Y.'",
      "- Adjectives must carry information or be deleted.",
      "- Rewrite 'There are several approaches you might consider' as '3 that actually work.'",
    ],
    caption: "Caption is brisk and confident: the promise, the three things it delivers, the ask. No warm-up.",
  },
  {
    id: "mentor",
    name: "The Mentor",
    blurb: "Warm, personal, honest about the hard part.",
    tone: "Warm and personal",
    guide: [
      "Voice: the mentor. Warm, spoken to one person, honest.",
      "- Second person throughout. Talk to one reader, not an audience.",
      "- Name the hard part out loud: 'This is the step everyone skips.'",
      "- Warmth comes from specificity and empathy, never from exclamation marks.",
      "- Allow one first-person aside where it earns trust ('I got this wrong for years').",
      "- Encourage without flattering. Respect the reader's intelligence.",
    ],
    caption: "Caption reads like a note to a friend who's stuck: acknowledge the struggle, hand over the fix, invite a reply.",
  },
  {
    id: "contrarian",
    name: "The Contrarian",
    blurb: "Names the common belief, then flips it. Fairly.",
    tone: "Contrarian",
    guide: [
      "Voice: the contrarian. Takes a stance, defends it honestly.",
      "- Open by stating the common belief plainly, then turn it: 'Everyone says X. Here's why that backfires.'",
      "- Never strawman. State the opposing view at its strongest, then answer it.",
      "- Take one clear position and admit its tradeoff on a later slide (honesty beats bravado).",
      "- The cover promises a reversal the reader hasn't heard, not just a hotter take.",
    ],
    caption: "Caption stakes the claim in the first line, gives the reasoning, and concedes the one real counterpoint.",
  },
  {
    id: "analyst",
    name: "The Analyst",
    blurb: "Numbers and mechanism first. Cool, precise.",
    tone: "Analytical",
    guide: [
      "Voice: the analyst. Precise, quantified, mechanism-first.",
      "- Lead with the number or the cause-and-effect, then the takeaway.",
      "- Define a term the moment you use it if the audience might not know it.",
      "- Cool register: explain 'why', never sell 'wow'. No exclamation.",
      "- Every figure traces to a source; if there is no sourced number, use a comparative label, not a guess.",
    ],
    caption: "Caption is a tight brief: the finding, the number behind it, what to do with it, the source.",
  },
  {
    id: "hype",
    name: "The Hype",
    blurb: "High-energy and playful. Still honest, still concrete.",
    tone: "Playful",
    guide: [
      "Voice: the hype. Punchy, rhythmic, fun.",
      "- Energy comes from strong verbs, rhythm, and one surprising turn per slide, not from exclamation marks or CAPS.",
      "- Keep it concrete: a specific noun beats a big adjective.",
      "- Wordplay is welcome when it lands in one beat; cut it if it needs explaining.",
      "- Hard ban still holds: no 'game-changer', 'must-have', 'you need this', 'unlock', 'supercharge', no fake urgency.",
    ],
    caption: "Caption has momentum: a hooky first line, quick punchy value lines, a fun but real CTA.",
  },
];

export const VOICE_BY_ID = new Map(VOICES.map((v) => [v.id, v]));

export const DEFAULT_VOICE: VoiceId = "straight";

export function getVoice(id: string | undefined): Voice {
  return VOICE_BY_ID.get((id ?? "") as VoiceId) ?? VOICE_BY_ID.get(DEFAULT_VOICE)!;
}

/** The instruction block for a voice, ready to splice into the system prompt. */
export function voiceSystemPrompt(id: string | undefined): string {
  const v = getVoice(id);
  return [`## Voice: ${v.name}`, ...v.guide].join("\n");
}
