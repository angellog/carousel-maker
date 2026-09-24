# Launch readiness — auth, security & Flutterwave billing

Status of the pre-launch batch for **The Carousel Maker**. Tracks 1–2 are done;
3–5 are one connected build (accounts → server-side entitlements → payments) and
need one architecture decision before code.

---

## ✅ Done (committed `11cf0fc`)

1. **Model/provider hidden from users.** The studio no longer prints
   "Written by gpt-oss-120b · Groq" (`page.tsx`). Only a neutral "Sources saved
   with the download" note remains when research ran.
2. **Top-2 functional buttons elevated.** "Make it great" (solid) + "My picks"
   (new tinted `btn-brand`) now read as the two clear actions; "Open" recedes.
3. **Baseline security headers** (`next.config.ts`) + **`.gitignore` hardened**
   to `.env*`.

---

## 🔒 Security review — findings & status

Full audit done. Ranked, with disposition:

| # | Sev | Finding | Status / plan |
|---|-----|---------|---------------|
| 1 | **HIGH** | Pro & free-quota enforced only in browser `localStorage` (`cm-plan`, `cm-usage`) — trivially bypassable; `/api/generate` never checks a plan | **FIXED (2026-09-25).** `/api/generate` now calls `authorize()` ([`src/lib/access`](../src/lib/access)): server-side rolling-window counters keyed to a verified identity (signed licence → account → API-key fingerprint → IP). `localStorage` holds nothing authoritative; the licence is an HMAC token, not a client claim. Proven in `tests/route.generate.access.test.ts` (forged licence, client-claimed plan, and key-swap all refused). |
| 2 | MED | Hosted-key spend guard is in-memory per-instance (`ratelimit.ts`) — resets per replica | Use a shared store (Upstash Redis) via `setRateLimitStore`, **or** pin Railway to 1 replica and document it |
| 3 | MED | `/api/verify-key` is an unauthenticated, unthrottled key-validation oracle | **Fixed** — per-IP throttle (8/min) + body-size cap. Turnstile-on-verify optional follow-up |
| 4 | MED | No CSP / security headers | **Baseline headers shipped.** CSP tracked separately (needs nonce for inline theme + Next hydration; allowlist Google Fonts + Turnstile) |
| 5 | LOW | `.gitignore` missed plain `.env` | **Fixed** |
| 6 | LOW | Unrecognised upstream error text passed through to client | **Accepted** — deliberate, tested design (`content.test.ts:352`); agent confirmed no secrets/stack traces in these messages |
| 7 | LOW | Rate-limit slot not rolled back on failure; no request-body size cap | Body cap **done for verify-key**; `/api/generate` body cap + `decision.rollback()` pending (folds into the billing PR) |
| 8 | LOW | Fail-open when `TURNSTILE_SECRET` / `CAROUSEL_RATE_PER_WEEK` unset | **Launch env checklist** — must be set in prod |

**Verified clean:** no SSRF (all outbound fetches are fixed hosts), BYO-key
handling is sound (client-only, same-origin, discarded server-side, never
logged), no server secret exposed to client, Turnstile really verified
server-side, no command/HTML injection, no committed secrets, deps current.

Everything except #1 and #2 is small and independent — a "security PR" I can do
in one pass. #1 is the billing build.

---

## 🔑 Track 3 — Login proposal (recommended stack)

**Recommendation: Supabase (Auth + Postgres).** One dependency gives you all
four requested sign-in types *and* the database that Flutterwave entitlements
and the server-side security fix both need anyway.

| Priority | Method | How | Notes |
|----------|--------|-----|-------|
| 1 | **Google** | Supabase OAuth | 1-tap, covers most users |
| 2 | **Apple** | Supabase OAuth | Required for App Store / iOS credibility; privacy-forward |
| 3 | **Email** | Supabase **magic link** (passwordless) | No password storage = smaller attack surface, no reset flows |
| 4 | **LLM API key** | *Reframed:* not an identity — a keyless **"power mode"** | Key stays client-side (as today), unlimited local use, no account. Coexists with the above. An LLM key can't *be* a login, but it stays a first-class no-account path. |

**Why Supabase over alternatives**
- **vs Clerk:** Clerk has great auth DX but you'd *still* add a DB for
  subscriptions; Supabase bundles both and is cheaper at scale.
- **vs Auth.js/NextAuth:** more glue code, and you bring your own DB anyway.
- **vs Firebase:** Firestore is awkward for relational billing/entitlements;
  Postgres fits.
- Server-side JWT verification drops straight into the Next route handlers
  (fixes security #1). Generous free tier, Railway-friendly, and provisionable
  from this session.

---

## 💠 Pricing — SUPERSEDED 2026-09-25

The four-tier subscription below was replaced by a single one-time licence.
Current model, economics and operations: **[MONETIZATION.md](MONETIZATION.md)**.

- Every feature free; **2 carousels a week** is the only caveat.
- **$9 once** (founding cohort of 5,000, then $19) lifts the cap forever.
- Bring-your-own-key is a first-class free path, capped the same way — the
  licence sells software, not compute.
- Accounts are no longer a prerequisite for billing: a licence is a signed
  token, so Supabase stays a *later*, optional decision (the `AccountResolver`
  seam is ready). **The $10/month provisioning question no longer blocks
  launch.**

<details>
<summary>Superseded: the 2026-09-23 subscription tiers</summary>



| Entitlement | Free $0 | Starter $5/mo | Pro $19/mo | Lifetime $59 once |
|---|:--:|:--:|:--:|:--:|
| Carousels | **2 lifetime** | 30 / month | ♾️ | ♾️ |
| Customize (template/palette/voice) | ❌ | ✅ | ✅ | ✅ |
| Hosted web research | ❌ | ✅ | ✅ | ✅ |
| No attribution line | ❌ | ✅ | ✅ | ✅ |
| Inspiration (Match a look) | ❌ | ❌ | ✅ | ✅ |
| Brand Kit | ❌ | ❌ | ✅ | ✅ |

Free = a real 2-carousel trial on Art Director auto-pick. Starter = "make it
yours," capped. Pro = unlimited + power features. Lifetime = Pro forever, one
payment. `plan.ts` is the source of truth; Flutterwave maps price IDs to these.
The new `customize` entitlement is defined but **not yet UI-enforced** — that
gating pairs with the server-side enforcement in the billing build.

</details>

## 💳 Track 5 — Flutterwave billing — BUILT 2026-09-25

Implemented for the one-time licence: `/api/billing/checkout`,
`/api/billing/webhook` (verif-hash + server-to-server re-verify + idempotent by
transaction id), `/api/license/redeem`, `/api/license/verify`, and the `/unlock`
receipt page. Amounts are priced server-side from the ledger, never from the
client; underpayments and non-USD charges are refused. 21 route tests cover it.

Still needed before taking real money: live Flutterwave keys,
`CAROUSEL_LICENSE_SECRET`, and `CAROUSEL_LICENSE_LEDGER` on the Railway volume.

<details>
<summary>Original subscription-era architecture notes</summary>



Flutterwave is the processor. It sits on top of the accounts layer above.

**Env (server-only):** `FLW_PUBLIC_KEY`, `FLW_SECRET_KEY`, `FLW_SECRET_HASH`
(webhook signature), `FLW_ENCRYPTION_KEY`.

**Data (`subscriptions` table):** `user_id`, `plan`, `status`
(active/canceled/past_due), `provider`, `flw_customer_id`, `tx_ref`,
`current_period_end`, timestamps. Plus a `processed_events` table for webhook
idempotency.

**Flow**
1. Signed-in user taps **Go Pro** → `POST /api/billing/checkout` creates a
   Flutterwave payment (Standard/inline) with `tx_ref = "${userId}:${uuid}"` and
   `redirect_url = /api/billing/callback`. For recurring, use a Flutterwave
   **Payment Plan** created once and subscribed per user.
2. **`/api/billing/webhook`** — verify the `verif-hash` header equals
   `FLW_SECRET_HASH`; on `charge.completed`/subscription events, **re-verify** via
   `GET /transactions/:id/verify` (defense in depth), then upsert the
   subscription row. Webhook is the source of truth; idempotent by event id.
3. `/api/billing/callback` shows the user a success/pending state (does **not**
   grant access itself — the webhook does).
4. **Entitlement read is server-side:** `/api/generate` and feature gates read
   the user's plan from the DB via their Supabase session. `plan.ts` `can()`
   stays as the entitlement *definition*; the *proof* becomes the subscription
   row. `localStorage` becomes a non-authoritative cache. → **fixes security #1.**

**Open specifics** (defaults I'll use unless you say otherwise): recurring
monthly **subscription** (matches the current Pro model); **currency** — decision
below (Flutterwave: NGN/GHS/KES/ZAR/USD…).

---

</details>

## Suggested build order

1. ~~**Server-side entitlements**~~ — **done 2026-09-25** (fixes #1).
2. ~~**Flutterwave**~~ — **done 2026-09-25**: checkout + webhook + redeem + receipt page.
3. **Launch checklist** — set `CAROUSEL_LICENSE_SECRET`, `CAROUSEL_LICENSE_LEDGER`
   (volume), Flutterwave live keys + `FLW_SECRET_HASH`, Turnstile keys,
   `CAROUSEL_DAILY_BUDGET`; confirm `CAROUSEL_LICENSE_DEV_UNLOCK` is **unset**;
   smoke-test a real $9 charge in Flutterwave test mode.
4. **Security leftovers** — finding #2 (shared rate-limit store, or keep 1 replica)
   and #4 (CSP).
5. **Accounts** — optional now, not blocking. Supabase drops into the
   `AccountResolver` seam when it earns its $10/month.
