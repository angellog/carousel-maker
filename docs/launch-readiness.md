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
| 1 | **HIGH** | Pro & free-quota enforced only in browser `localStorage` (`cm-plan`, `cm-usage`) — trivially bypassable; `/api/generate` never checks a plan | **Fixed by the billing build** — gate paid actions on the server against a real subscription row + server-side quota counter. *This is why billing needs accounts first.* |
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

## 💳 Track 5 — Flutterwave billing architecture

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

## Suggested build order

1. **Security PR** (findings #3, #6, #7, env checklist #8) — independent, ship now.
2. **Accounts** — Supabase Auth (Google, Apple, email magic link) + `subscriptions` schema + server-side session in route handlers.
3. **Server-side entitlements** — move `can()`/quota enforcement into `/api/generate` (fixes #1); shared rate-limit store (#2).
4. **Flutterwave** — checkout + webhook + callback, tied to the user.
5. **Launch checklist** — prod env vars, replica/rate config, CSP, smoke test paid flow in Flutterwave test mode.
