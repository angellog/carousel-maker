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

`src/lib/plan.ts` is the single source of truth for what each plan grants. It is
pure and read by both the UI (to gate features) and, once wired, the server (to
authorise paid actions).

**Design principle:** the free tier must produce genuinely great, unwatermarked
carousels, or nobody trusts the tool enough to pay. So **Pro never degrades
output quality.** It removes friction and unlocks the magic.

| | Free | Pro (`$8/mo`) |
|---|---|---|
| Templates | All 32 | All 32 |
| Voices | All 5 | All 5 |
| Art Director | ✓ | ✓ |
| Research | Keyless (Wikipedia/Web) or your key | Deeper web tier by default, no key |
| Free carousels | 2 / week | Unlimited |
| Export | Full-res 4:5, no watermark | Full-res 4:5, no watermark |
| Inspiration | — | ✓ |
| Brand Kit | — | ✓ |
| Caption attribution line | Present | Removed |

The free quota (2 / week) is enforced client-side today (`cm-usage`, keyed by ISO
week) as the soft product limit; the server's `CAROUSEL_RATE_PER_WEEK` gives a
hard per-IP backstop. A true per-user weekly cap belongs on the server once
accounts exist (below).

## Wiring payments (the one honest gap)

Billing and accounts are intentionally **not** wired in this build — they need
external setup and secrets this repo does not carry. The entitlement layer,
gating, and upgrade surface are complete and real; only the "prove the plan"
step is stubbed. In `UpgradeSheet`, **Start Pro** unlocks Pro on the device so
the Pro experience is demonstrable and testable.

To make it a real subscription:

1. **Accounts.** Add auth (e.g. Clerk, Auth.js, or Supabase Auth). Replace the
   `cm-plan` / `cm-usage` local values with the signed-in user's plan and a
   server-side daily counter.
2. **Checkout.** Add Stripe. `Start Pro` → a Checkout Session; on
   `checkout.session.completed` (webhook), set the user's plan to `pro`.
3. **Server gate.** In `src/app/api/generate/route.ts`, read the user's plan and
   call `quotaState(plan, usedToday)` before generating; return `402`/`429` when
   blocked. The client already handles a JSON error body gracefully.
4. **Entitlement checks.** Keep every gate reading `can(plan, feature)` from
   `plan.ts` so the plan definition stays the single source of truth.

Nothing else in the product needs to change — the seams are already here.

## Deployment

Self-hostable on a 1 vCPU box; all rendering/export happens in the browser, so
the server only runs the two API routes. See the deploy plan in the repo root and
[PROVIDERS.md](PROVIDERS.md) for the environment matrix (keyless / Groq /
Anthropic).
