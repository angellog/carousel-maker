# Carousel Maker — design system

Two design surfaces live in this repo, and they follow different rules:

1. **The app UI** — the phone-first studio the creator uses. Governed by the
   token system and component rules below (`src/app/globals.css`).
2. **The carousel output** — the slides themselves, drawn on canvas by the
   presets. Governed by the content + template design laws (further down).

Both were built against a specific, mined design canon: the *impeccable*,
*emil-design-eng*, *canvas-design*, *taste*, *famous-ig-carousel*, *ux-copy* and
*research-synthesis* skills. This document is the durable distillation.

---

## 1. The app UI

### Tokens (`src/app/globals.css`)

All colour is OKLCH so the ramps stay perceptually even. Tokens are **semantic**
and **theme-aware**; components reference tokens, never literals.

- **Neutrals** — a cool off-white ground (chroma nudged toward the brand hue),
  deliberately *not* cream/sand/paper (the 2026 AI default).
- **Brand** — mint (`--color-brand`) with a steel-sky second accent
  (`--color-brand-2`). One accent does the work; the second is used sparingly.
- **Semantic** — `--color-ok / warn / danger`, separate from the brand accent.
- **Motion** — Emil Kowalski curves: `--ease-out: cubic-bezier(0.23,1,0.32,1)`,
  `--ease-in-out`, `--ease-drawer`. Durations `--t-press/fast/mid/sheet`, all UI
  under 300ms. Never `ease-in` for UI.
- **Structure** — radii (`--r-sm…xl`), shadows (`--shadow-1/2/pop`), and a
  **semantic z-index scale** (`--z-dock/sticky/scrim/sheet/toast`) — never magic
  numbers.

### Theming

Three states, handled correctly:

- Bare `:root` defines the complete **light** palette.
- `@media (prefers-color-scheme: dark)` under `:root:not([data-theme="light"])`
  applies **dark** by OS preference, so an explicit light choice still wins.
- `:root[data-theme="dark"]` applies dark by explicit toggle, winning both ways.

A boot script in `layout.tsx` stamps the saved theme before first paint (no
flash). `ThemeToggle` cycles System → Light → Dark.

### Component & interaction rules

- **Contrast floors:** body ≥ 4.5:1, large text ≥ 3:1. No light-grey-for-elegance.
- **Focus:** one visible `:focus-visible` ring everywhere, for keyboard users only.
- **Feedback:** buttons scale to `0.97` on `:active`; nothing appears from nothing
  (fades pair opacity with a small translate, never `scale(0)`).
- **Touch:** every control clears a 48px thumb target; `touch-action: manipulation`.
- **Reveals** enhance an already-visible default (`.rise`). Never gate content
  visibility on a class transition — it never fires in a headless render.
- **Reduced motion** is honored globally.
- **Layout:** flex for 1D, grid for 2D; `gap` over per-element margins; a ≥16px
  side gutter at every width; the app column caps at 560px.

### The absolute bans (app UI)

Match-and-refuse. If you're about to write one, restructure instead.

- Side-stripe accent borders (`border-left` as decoration).
- Gradient text (`background-clip: text` on a gradient). Emphasis by weight/size.
- Glassmorphism as a default.
- The hero-metric SaaS template (big number + label + gradient).
- Identical card grids repeated endlessly; **nested cards are always wrong**.
- An uppercase tracked eyebrow above *every* section. One named kicker is voice;
  an eyebrow on every block is AI grammar.
- Numbered section markers (`01 / 02 / 03`) as default scaffolding — only when the
  section genuinely *is* an ordered sequence.

### UX copy (`ux-copy`)

Verb-first CTAs that name the outcome ("Make it great", "Use this look", "Start
Pro"). Errors are *what happened + why + how to fix*. Empty and loading states
are real, never a bare spinner. Free-tier limits are stated plainly, never hidden.

---

## 2. The carousel output

The slides are the actual deliverable; the design laws here are enforced in the
copywriter prompt (`src/lib/content/prompt.ts`), the offline writer, the schema
normaliser, and the presets.

### Content laws

- **One idea per slide.** If a headline needs a comma to hold two ideas, split it.
- **Headlines 3–8 words, screenshot-worthy.** Slide 1 is the thumbnail; if it
  wouldn't stop the scroll, rewrite it.
- **Digits, not number-words** ("3 ways", "40%"). Enforced by
  `numberWordsToDigits`.
- **One accent per slide** — a single `**marked**` span carries the idea.
- **Open loops** — every body slide gives a reason to swipe.
- **Banned language** — no "game-changer", "must-have", "unlock", "supercharge",
  "in today's world", "let's dive in", or fake urgency/scarcity.

### Honesty (`research-synthesis`)

- Never invent a statistic. A figure must trace to a source in `deck.sources`.
- A stat slot with no sourced number carries a **label**
  ("BIGGEST FACTOR", "MOST COMMON"), never a fabricated percentage.
- Quotes are attributed only to people who actually said them.
- Separate observation from interpretation; quantify where possible.

### Template laws (`taste`, `canvas-design`, `famous-ig-carousel`)

- **Coherence beats novelty.** One visual world across the deck.
- **Cover-first.** The cover is the hook; every other slide delivers value — no
  filler / transition slides.
- **Type as art.** Information lives in the composition, not in paragraphs.
- 32 templates across distinct design systems; see [preset-research.md](preset-research.md).

### The AI-slop test

If someone could look at the output and say "AI made that" without doubt, it
failed. Run the check at two altitudes: could you guess the look from the topic
category alone (first reflex), or from category-plus-anti-reference (the trap one
tier deeper)? Rework until neither is obvious.
