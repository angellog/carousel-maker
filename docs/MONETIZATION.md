# Monetization — how The Carousel Maker makes money

One sentence: **every feature is free, two carousels a week, and $9 once lifts
the cap forever.**

---

## The model

| | Free | Your own key | Maker licence |
|---|:--:|:--:|:--:|
| Price | $0 | $0 | **$9 once** (founding), then $19 |
| Carousels | 2 / week | 2 / week | **Unlimited** |
| On our engine | 2 / week | — (uses your key) | 30 / month |
| Every template, voice, Art Director | ✅ | ✅ | ✅ |
| Match a look, Brand Kit, research | ✅ | ✅ | ✅ |
| Caption credit | one line | one line | none |

Two scarcities are metered separately, and the distinction is the whole design:

- **The licence cap** (`quota`) — carousels made, whoever's key paid for the
  words. This is what $9 lifts. It applies to bring-your-own-key users too:
  they pay for the compute, the licence pays for the software.
- **The hosted allowance** (`hostedQuota`) — runs on *our* embedded key, which
  costs us real money. Licence holders get 30 a month so that a creator with no
  API key is a first-class customer rather than a second-class one.

Definitions live in [`src/lib/plan.ts`](../src/lib/plan.ts); enforcement lives
in [`src/lib/access`](../src/lib/access).

## Why this shape

**The paywall gates consistency, not quality.** Nothing is crippled, so every
free carousel that gets posted is the product at its best — which is the only
form of marketing this thing can afford. The moment to pay arrives on its own:
you're posting three times a week and two isn't enough.

**The free tier keeps the caption credit.** It's the distribution loop, and it
gives the licence a second, visible reason to exist. One constant flips it:
add `"noAttribution"` to `FREE_FEATURES` in `plan.ts`.

**A licence is a signed token, not an account.** One-time purchases have no
renewal and no session to hang off, so the buyer gets a key that verifies with
one HMAC, works on any device they paste it into, and needs no database. See
[`access/license.ts`](../src/lib/access/license.ts).

**Counting happens on the server.** The old `localStorage` counter was a
suggestion. `/api/generate` now claims a slot before any work runs, and the
browser only displays what `/api/access` tells it.

## The founding cohort

The launch price is real scarcity rather than a countdown nobody can check:
**5,000 founding licences at $9, then $19.** The number shown in the app is the
count of licences actually issued, read from the ledger. When the cohort sells
out, the price steps up on its own — no deploy, no code change.

| Path | Buyers | Revenue |
|---|---|---|
| Flat $9 × 5,000 | 5,000 | $45,000 |
| **Ladder: 1,000 × $9, then 4,000 × $19** | 5,000 | **$85,000** |
| Current default: 5,000 × $9, then $19 | 5,000 | $45,000, and every buyer after that pays $19 |

To run the shorter founding cohort, set `CAROUSEL_FOUNDING_SEATS=1000`.

### What 5,000 buyers actually requires

At a 3% activated-user→buyer rate that's ~165,000 activated users; at 5%,
100,000. This is the number to plan distribution against — it is a far bigger
constraint than the price. The email captured at checkout is the asset that
makes buyer #2,000 cheaper than buyer #200.

### Cost per buyer

A hosted deck costs roughly a fifth of a cent on the current engine. So:

- A free user at full tilt: ~8.7 decks/month ≈ **$0.017/month**.
- 10,000 active free users ≈ **$17/month**; 100,000 ≈ $170/month.
- A licence holder using the full hosted allowance: 30 × ~$0.002 ≈
  **$0.06/month**, or ~$0.72/year against a $9 one-time payment.

The global ceiling is still `CAROUSEL_DAILY_BUDGET`, so a bad day costs what
you decided it could, not what the traffic decides.

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `CAROUSEL_LICENSE_SECRET` | — | **Required.** Signs and verifies licences. Changing it invalidates every licence ever issued. |
| `CAROUSEL_LICENSE_LEDGER` | in-memory | Path to the JSON-lines ledger (put it on the Railway volume). Without it the founding counter resets on restart. |
| `CAROUSEL_LICENSE_REVOKED` | — | Comma/space separated licence ids to refuse (refunds, abuse). |
| `CAROUSEL_LICENSE_DEV_UNLOCK` | off | Mints a licence with no payment. **Never set in production.** |
| `CAROUSEL_FOUNDING_SEATS` | 5000 | Size of the founding cohort. |
| `CAROUSEL_FOUNDING_PRICE` | 9 | Founding price, USD. |
| `CAROUSEL_STANDARD_PRICE` | 19 | Price after the cohort sells out. |
| `FLW_PUBLIC_KEY` / `FLW_SECRET_KEY` | — | Flutterwave. Without them checkout returns a clear "not live yet". |
| `FLW_SECRET_HASH` | — | Webhook shared secret. Without it the webhook refuses everything. |
| `RESEND_API_KEY` / `LICENSE_FROM_EMAIL` | — | Emails the licence key. Optional: the key is always shown on screen. |

Tuning the product itself: `FREE_WEEKLY_QUOTA` and
`MAKER_HOSTED_MONTHLY_QUOTA` in `plan.ts`.

## The money path, end to end

1. **Checkout** — `POST /api/billing/checkout {email}` prices the licence from
   the ledger (never from the client) and returns a Flutterwave link.
2. **Payment** — the buyer pays on Flutterwave and is redirected to `/unlock`.
3. **Redeem** — `/unlock` calls `POST /api/license/redeem {transactionId}`,
   which **re-verifies the charge server-to-server** (completed, USD, covers
   the price) before minting anything, then shows the key and stores it.
4. **Webhook** — `POST /api/billing/webhook` does the same thing independently,
   signature-checked and idempotent, so a buyer who closes the tab still gets
   their licence by email.
5. **Use** — the browser sends `x-cm-license` with every generate call;
   `authorize()` verifies it and the cap is gone.

Whoever gets there first (buyer or webhook) mints; the other finds the same
entry in the ledger and returns the same token. A retried webhook can never
burn a second founding seat.

## Operations

**Revoke a licence** (refund or abuse): add its id to
`CAROUSEL_LICENSE_REVOKED` and redeploy. Ids are in the ledger file.

**Re-send a lost key**: find the buyer's line in the ledger and re-sign it —
`issueLicense({ txId, email })` with the same transaction id returns the
identical token.

**Change the price**: set `CAROUSEL_FOUNDING_SEATS` /
`CAROUSEL_FOUNDING_PRICE` / `CAROUSEL_STANDARD_PRICE`. Existing licences are
unaffected; they never expire.

**Rotate the signing secret**: don't, unless you must. Every issued licence
stops verifying. If it's unavoidable, re-issue from the ledger and email the
new keys.

## What this deliberately does not do

- **No subscription.** One payment was the whole promise; adding a recurring
  tier later would need a new plan id and a real accounts layer.
- **No accounts.** The `AccountResolver` hook in
  [`access/identity.ts`](../src/lib/access/identity.ts) is where Supabase drops
  in when it's worth the $10/month — one adapter, no route changes.
- **No device limit.** A licence works anywhere it's pasted. Policing that
  would cost more goodwill than the sharing costs in revenue.
- **No IP-based fairness claims.** The IP floor is a spend guard. Shared
  offices and mobile carriers behind CGNAT look like one visitor, and a VPN
  resets it; treating it as fairness would punish the wrong people.

## Honest risks

1. **A key is not an identity.** A bring-your-own-key user can mint a new key
   to reset their two. Accepted: they're paying their own compute, and the
   people who'd bother are not the people who'd pay $9.
2. **One-time revenue against a permanent free tier.** Serving costs grow with
   users while revenue is one-off. Mitigated by near-zero hosted cost and the
   daily budget ceiling, but it is the reason to watch the free-tier spend line.
3. **The founding counter needs the volume.** Without
   `CAROUSEL_LICENSE_LEDGER` on durable storage, a restart resets the count and
   the seat numbers repeat.
