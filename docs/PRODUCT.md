# Carousel Maker — product

## What it is

A phone-first studio that turns a topic into a ready-to-post Instagram carousel:
research → write → typeset → export. It is designed to be genuinely useful for
free and worth a small subscription for people who post on a schedule.

## The north star: zero image-generation models

Every pixel is vectors, type, canvas and math. No diffusion, no generated
photos, no generated illustration. This is the identity, not a limitation. It is
what makes the output fast, free to run, deterministic, legally clean, and
impeccable instead of AI-slop. Any feature added here must hold that line —
including Inspiration, which reads an uploaded image with pure canvas math, never
a vision model.

## Who it's for

Everyday creators and small brands who want to post carousels that get saved and
shared, without design skills, a subscription to five tools, or a prompt-writing
habit. It works with no account and no API key.

## The pillars

| Pillar | What it means in the product |
|---|---|
| **Topic in, carousel out** | One field, one primary action. `Make it great` runs the whole pipeline. |
| **Taste is the product** | 32 templates across many design systems, each obeying real design laws (see [DESIGN.md](DESIGN.md)). |
| **Works for anyone, keyless** | Free Wikipedia/Web research; bring your own key for live web; hosted brains in between. See [PROVIDERS.md](PROVIDERS.md). |
| **Honest** | Never invents a statistic. Real figures trace to a source; a stat with no sourced number becomes a label. |
| **Personality** | Five writer voices; the copy has a point of view, not a template smell. |
| **Intelligence** | The Art Director reads the topic and picks the template, palette, slide count, tone and voice. |

## The magic features

### Art Director (`src/lib/director`)
Deterministic. Reads the topic (and optional material) → detects the content
format (comparison, how-to, list, data, myth-bust, story, quote, deep-dive) →
picks the best template, a palette from that template's own set (so the look
stays coherent), a sensible slide count, and a matching voice. Returns short
human reasons. Surfaced live on the compose screen as a suggestion, and run in
one tap by **Make it great**. Free.

### Inspiration (`src/lib/inspiration`)  · Pro
Upload a screenshot of any carousel or post you like. Pure canvas math extracts
its palette (median-cut quantization), guesses background/foreground/accent,
measures layout density (an edge-fraction proxy), and matches the closest
template — tinted to a palette derived from your image. No image model, no
network; it runs on the device.

### Voices (`src/lib/content/voice`)
Five committed personas — straight, mentor, contrarian, analyst, hype — each with
concrete diction rules. The full persona shapes the model prompt; the keyless
draft still gets deterministic flavor (cover kicker + CTA), so the free tier has
a register too. Honesty and readability rules never bend for a voice.

### Brand Kit · Pro
Save your handle, voice and colours as defaults; they auto-apply to every new
deck. Stored per-device (`cm-brand`); moves to the account once auth is wired.

## Plans & entitlements (`src/lib/plan.ts`)

`src/lib/plan.ts` is the single source of truth for what each plan grants, and
[`src/lib/access`](../src/lib/access) is what enforces it. Full reasoning,
economics and operations: [MONETIZATION.md](MONETIZATION.md).

**Design principle:** every *feature* is free. The only caveat is volume. A
crippled free tier would poison the word of mouth this product runs on, so the
$9 licence sells consistency — the cap coming off — not capability.

| | Free | Your own key | Maker licence ($9 once, first 1,000) |
|---|---|---|---|
| Templates, voices, Art Director | All | All | All |
| Match a look, Brand Kit | ✓ | ✓ | ✓ |
| Research | Keyless or your key | Your key (live web) | Either |
| Carousels | 2 / week | 2 / week | **Unlimited** |
| On our engine | 2 / week | — | 30 / month |
| Export | Full-res 4:5, no watermark | Same | Same |
| Caption credit line | Present | Present | Removed |

Two meters, counted separately: the **licence cap** (every carousel, whoever's
key paid) and the **hosted allowance** (only the ones on our embedded key, the
ones that cost us money). The licence lifts the first and bounds the second.

Both are enforced in `/api/generate` against a server-side counter keyed to the
strongest identity that verifies — licence, then account (when accounts exist),
then API-key fingerprint, then IP. `localStorage` holds nothing authoritative
any more.

## Payments — wired

Checkout, verification, licence issue and delivery are all implemented:

- `POST /api/billing/checkout` — prices from the ledger, returns a Flutterwave
  link. Refuses politely when keys are absent.
- `/unlock` → `POST /api/license/redeem` — re-verifies the charge
  server-to-server before minting, then shows the key.
- `POST /api/billing/webhook` — signature-checked, re-verified, idempotent.
- `POST /api/license/verify` — unlocks a second device from a pasted key.

What remains is operational, not code: Flutterwave live keys, a
`CAROUSEL_LICENSE_SECRET`, and a persistent path for
`CAROUSEL_LICENSE_LEDGER`. See [MONETIZATION.md](MONETIZATION.md#configuration).

Accounts (Google / Apple / email) are still optional and still unwired — the
`AccountResolver` seam in `access/identity.ts` is where they land, and nothing
else has to change when they do.

## Deployment

Self-hostable on a 1 vCPU box; all rendering/export happens in the browser, so
the server only runs the two API routes. See the deploy plan in the repo root and
[PROVIDERS.md](PROVIDERS.md) for the environment matrix (keyless / Groq /
Anthropic).
