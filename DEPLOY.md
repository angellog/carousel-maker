# Deploying Carousel Maker on a VPS

Host it once, and anyone can open the site, build a carousel, download it, and
go — **without a key of their own**. The key lives on your server; visitors never
see it. This guide gets you from a blank Ubuntu VPS to a live HTTPS URL.

> **Read this first — a subscription is not an API key.**
> A **Claude Pro/Max subscription** lets *you* use claude.ai; it is **not** an API
> key and is not licensed to power an app that serves other people. The backend
> pattern here needs a pay-as-you-go **Anthropic API key** from
> [console.anthropic.com](https://console.anthropic.com) — billed separately from
> any subscription. If you'd rather not pay per visitor, use the **free Groq**
> option or the **keyless** tier below; the deploy is identical either way.

## Fastest path — Railway (recommended for the hosted demo)

Railway runs the app as a **persistent container**, so long streaming requests
just work (no serverless timeouts) and the built-in spend limiter holds in memory
on a single instance. This is the "safe public demo": your embedded key, bot-
shielded and budget-capped, with **no database and no accounts** yet.

The repo already ships everything Railway needs: `Dockerfile`,
`.railway/railway.ts`, and `output: "standalone"`.

> **The Railway config lives in `.railway/railway.ts`, not `railway.toml`.**
> Railway's Config as Code (`railway.toml` / `railway.json`) is deprecated: new
> services **cannot** opt into it, and files on existing services stop being
> read on **2026-12-01**. This repo's `railway.toml` was deleted for that reason
> — it would have been a file full of settings Railway never read, including the
> replica count and the healthcheck path. Everything moved to
> [Infrastructure as Code](https://docs.railway.com/infrastructure-as-code),
> which the CLI applies on demand:
>
> ```bash
> npm install                 # installs the `railway` devDependency that evaluates the file
> railway link                # pick the project + environment, once
> railway config plan         # show the diff; changes nothing
> railway config apply        # apply, after you have read the diff
> ```
>
> Railway does **not** read `.railway/` during a deploy, so this is a reviewable
> record plus a one-command way to enforce it — not an automatic guard. The
> automatic guard is at boot (see the enforcement note below).
>
> **Variables are deliberately not in that file.** Secrets stay on the Railway
> service; see steps 4–7. `env` is omitted entirely rather than listed partially,
> because an `env` block is a claim about the whole set and a partial one invites
> an apply that proposes deleting the rest.

> **The production environment is enforced, not checklisted.** Several of this
> app's safety switches are fail-**open** when unset — no `CAROUSEL_RATE_PER_WEEK`
> means no weekly cap at all, no `TURNSTILE_SECRET` means no bot shield at all.
> So with `NODE_ENV=production` the server asserts its environment in
> `src/instrumentation.ts` before it accepts a single request: it prints every
> missing or unusable variable by name and **exits 1**. Railway's
> `restartPolicyType = "ON_FAILURE"` turns that into a crash loop with a readable
> deploy log rather than a green deploy that is wide open. The contract is
> `src/lib/env/require.ts`, the full list with consequences is
> `.env.production.example`, and `GET /api/health` reports the verdict — it is
> the Railway healthcheck path, so a green deploy means the contract passed.
>
> A **first deploy will therefore crash-loop until steps 4–7 below are done.**
> That is the intended behaviour; read the deploy log, it names what is missing.
> Nothing changes for local dev, `next build`, or the test suite.

**Steps (about 15 minutes):**

1. **Push to GitHub.** Railway deploys from a repo. Make sure `main` is pushed.
2. **Create the service.** [railway.app](https://railway.app) → *New Project* →
   *Deploy from GitHub repo* → pick this repo. Railway finds the `Dockerfile` and
   builds it. Name the project and the service **`carousel-maker`**, so
   `railway config plan` lines up with `.railway/railway.ts` instead of
   proposing a second service. Leave replicas at **1** — and read
   *[One replica, and why](#one-replica-and-why-more-than-one-is-currently-a-bug)*
   before you ever change that.
3. **Set the brain (free Groq).** In the service's *Variables*, add:
   ```
   CAROUSEL_OSS_BASE_URL=https://api.groq.com/openai/v1
   CAROUSEL_OSS_MODEL=openai/gpt-oss-120b
   CAROUSEL_OSS_API_KEY=gsk_...            # your Groq key (free)
   CAROUSEL_OSS_LABEL=gpt-oss-120b · Groq
   ```
   Do **not** add an Anthropic key yet — without accounts, anyone could spend it.
   Claude turns on in Milestone 2 once Pro is gated by login.
4. **Set the budget guardrails.** *Required — the server refuses to start
   without `CAROUSEL_RATE_PER_WEEK` and `CAROUSEL_DAILY_BUDGET`.* Tune to taste
   (this example gives a hard free ceiling of **2 carousels per IP per week**,
   matching the app's free tier):
   ```
   CAROUSEL_RATE_PER_MIN=15
   CAROUSEL_RATE_PER_WEEK=2
   CAROUSEL_DAILY_BUDGET=300
   ```
   Note: a per-IP weekly cap is a blunt instrument — people behind one office or
   mobile-carrier IP share the count. The in-app free quota (2/week, per device)
   is the softer product limit; a true per-user weekly cap needs accounts
   (Milestone 2). Loosen `CAROUSEL_RATE_PER_WEEK` if shared-IP users get blocked.
   Do **not** set `CAROUSEL_RATE_DISABLED` — it switches off every ceiling at
   once, including the daily budget, and is refused in production.
5. **Add the bot shield (Cloudflare Turnstile, free).** *Required — this is the
   only thing standing between a loop script and your API budget.*
   [dash.cloudflare.com](https://dash.cloudflare.com) → *Turnstile* → add a widget
   for your Railway domain. Then set:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...    # public, safe in the browser
   TURNSTILE_SECRET=0x...                   # server-only
   ```
   `NEXT_PUBLIC_*` is baked in at build time, so a change there needs a rebuild,
   not just a restart.
6. **Turn on licensing.** *Required.* Attach a **volume** (*Settings → Volumes*)
   mounted at `/data` first — the licence ledger has to outlive a deploy, or the
   founding-seat counter resets, seat numbers repeat, and a webhook retry mints a
   second licence for the same payment. The boot check refuses to serve if
   `CAROUSEL_LICENSE_LEDGER` is not inside the volume's mount path.
   ```
   CAROUSEL_LICENSE_SECRET=<long random string>   # rotating it voids every licence
   CAROUSEL_LICENSE_LEDGER=/data/licences.jsonl   # must be on the volume
   RAILWAY_RUN_UID=0                              # see below — not optional here
   ```
   `RAILWAY_RUN_UID=0` is the one that looks like boilerplate and is not.
   **Railway mounts volumes as `root`**, and this image's final stage runs
   `USER node`, so without it `/data` is read-only to the server. `FileLedger`
   swallows write failures on purpose — to keep serving through a disk
   wobble — which means the symptom of getting this wrong is not an error. It is
   a $9 sale that completes, unlocks for the buyer, and is recorded nowhere. The
   boot probe in `src/lib/env/volume.ts` exists solely to turn that into a crash
   loop at deploy time, and `/api/health` re-checks it on every healthcheck, so
   a volume that goes read-only later turns the deployment red instead of
   quietly losing sales.

   Never set `CAROUSEL_LICENSE_DEV_UNLOCK` here; it mints licences for free and a
   production boot with it present at all is refused.
7. **Connect payments (Flutterwave).** *Required.* From the Flutterwave
   dashboard, and the webhook hash must match what you configured there:
   ```
   FLW_PUBLIC_KEY=FLWPUBK-...
   FLW_SECRET_KEY=FLWSECK-...
   FLW_SECRET_HASH=<the same value as in the FLW dashboard>
   ```
8. **Deploy & open.** Railway builds and gives you a `*.up.railway.app` URL.
   Check `GET /api/health` first — `{"status":"ok"}` means the boot-time contract
   passed on the process that is serving you. Then generate a carousel; it should
   stream a Groq-written deck. Add a custom domain in *Settings → Networking*
   when ready (Railway handles TLS).

**What's next (Milestone 2):** add Supabase (Auth + Postgres), move the limiter to
a `PostgresRateLimitStore` via `setRateLimitStore`, gate the embedded Claude+search
key to logged-in Pro users, and cache research. Then Stripe (Milestone 3).

## One replica, and why more than one is currently a bug

**Run exactly one replica.** This is not a cost trade-off or a "we'll scale
later" note. With the code as it stands, a second replica is incorrect, and the
way it is incorrect costs money we have already taken.

### What breaks

The licence ledger (`src/lib/access/ledger.ts`, `FileLedger`) reads the whole
ledger into memory at boot and appends to a JSON-lines file on the volume. It is
per-process state. Two replicas means two ledgers that never see each other:

- **`issued()` diverges.** It is the founding-seat counter — the thing that makes
  "licence #312 of 1,000" a fact rather than copy. Two replicas each counting
  their own sales means the number is fiction, and **two buyers can be sold the
  same seat number**.
- **`findByTx()` idempotency is per replica.** Flutterwave retries webhooks. A
  retry that lands on the other replica finds no record of the payment and
  **mints a second licence for one $9**.

And it cannot be fixed by sharing the file: **Railway volumes cannot be used with
replicas at all** ([volume
caveats](https://docs.railway.com/volumes/reference#caveats)). A volume attaches
to one service instance. So the choice is not "one replica or a shared file" —
there is no shared file on offer.

The in-memory rate limiter (`src/lib/providers/ratelimit.ts`,
`MemoryRateLimitStore`) has the same shape and is the one usually named, but it
is the smaller problem: a per-replica limiter means the free-tier ceiling is N
times higher than intended. That costs us API spend. The ledger breaks *money
correctness* — seats sold twice, licences issued twice for one payment.

Which is why **swapping Upstash in for the rate limiter alone would be worse than
doing nothing.** It would close the visible hole, make multi-replica look safe,
and leave the licence ledger silently double-issuing. A ceiling on the money
leak, in exchange for a break in money correctness. That swap is deliberately
not in this repo yet.

### What actually enforces it

Three things, in increasing order of how much you can rely on them:

| Where | What it does | How much it holds |
|-------|--------------|-------------------|
| `.railway/railway.ts` | `replicas: 1`, in version control, diffable | Declares intent; applied only when someone runs `railway config apply` |
| The attached volume | Railway refuses replicas on a service with a volume | **Platform-enforced.** This is the real pin |
| Boot check (`src/lib/env/require.ts`, `src/lib/env/volume.ts`) | Refuses to serve if the ledger is not inside the volume's mount path, or is not writable | Enforced on every production start, and re-checked by `/api/health` |

The boot check is where the belt and braces meet: it does not assert "one
replica" directly, because **Railway does not expose a replica count**. The
injected variables are `RAILWAY_REPLICA_ID` and `RAILWAY_REPLICA_REGION` — they
say *which* replica a process is, never how many exist, so a process on replica 3
of 5 cannot tell itself apart from the only replica. Rather than write a check
that always passes, the code asserts the thing that *implies* one replica and is
observable: the ledger is on a mounted volume, and that volume is writable. Get
either wrong and the service crash-loops with the reason in the deploy log. The
reasoning for that choice is in the comment on `PRODUCTION_ENV_INVARIANTS`, so it
survives the next person who goes looking for the replica check and does not find
one.

### When one replica stops being necessary

Both of these, shipped **together as one change**:

1. The ledger moves to Postgres — `LicenseLedger` is already a three-method
   interface (`issued`, `findByTx`, `record`) and `setLedger` is already the
   injection point.
2. A shared rate-limit store goes in through `setRateLimitStore` —
   `RateLimitStore` is already a small interface with an in-memory
   implementation to copy.

**Neither one alone.** Postgres-only leaves the limiter per-replica (spend leak).
Shared-store-only leaves the ledger per-replica (duplicate licences). The seams
for both already exist and are the right shape — nothing here needs redesigning,
so this is a swap of two implementations, not a refactor. When it lands, delete
`replicas: 1` from `.railway/railway.ts`, drop the ledger-on-volume invariant,
and write the replica check that is honestly impossible today.

## Why this is cheap to run

Every image is rendered, zipped, and downloaded **in the visitor's browser**. The
server only runs two small Node API routes (generate + key-check), ships no native
graphics library, and needs no GPU. **A 1 vCPU / 1 GB VPS is plenty.**

## What you need

- A VPS (Ubuntu 22.04+), with **Docker** and the **Docker Compose plugin**.
- A domain name, with a **DNS A record** pointing at the VPS's IP. HTTPS is then
  fully automatic.

## 1. Choose an engine

Pick one; it's decided entirely by environment variables.

| Engine | What visitors get | Who pays | Set |
|--------|-------------------|----------|-----|
| **Keyless** | Real facts (Wikipedia/Web), templated wording | nobody | nothing |
| **Free OSS (Groq)** | Real AI-written copy | ~$0 (free tier) | `CAROUSEL_OSS_*` |
| **Anthropic (paid)** | Best quality, live web search | **you, per deck** | `CAROUSEL_API_KEY` |

For a public link, **Groq or keyless** avoids paying for strangers. Use the paid
Anthropic key only with a `CAROUSEL_DAILY_BUDGET` you're comfortable with.

## 2. Configure

On the VPS, in the project directory:

```bash
cp .env.production.example .env.production
chmod 600 .env.production          # key readable only by you
nano .env.production               # uncomment ONE engine block, paste your key
```

Fill in **everything** under *Required in production* in that file, not just the
engine block. The container runs with `NODE_ENV=production`, so it asserts those
variables at startup and exits 1 naming any that are missing — `docker compose
logs app` will show exactly which. See the enforcement note in the Railway
section above for why.

Then set your domain in `Caddyfile` (replace `carousel.example.com`).

`.env.production` is git-ignored — never commit it.

## 3. Deploy

```bash
docker compose up -d --build
```

That's it. Caddy fetches a TLS certificate for your domain and starts serving
`https://your-domain`. Check it:

```bash
docker compose ps                        # both services "running"
curl -s https://your-domain/api/health   # {"status":"ok"} = the env contract passed
docker compose logs -f app               # generation logs
```

Open the domain, type a topic, hit **Make carousel**, then **Download all** — the
ZIP is produced in your browser.

## 4. Updating

```bash
git pull
docker compose up -d --build   # rebuild + restart, ~no downtime
```

## Cost & abuse — read before going paid

With a paid Anthropic key, **every generation bills to you** (roughly a few cents
to ~$0.10+ with web search). The app has a built-in rate limiter that guards the
paid engines only (bring-your-own-key and keyless are never limited):

| Variable | Default | In production | Meaning |
|----------|---------|---------------|---------|
| `CAROUSEL_RATE_PER_MIN` | 5 | optional | per-visitor burst ceiling |
| `CAROUSEL_RATE_PER_DAY` | 50 | optional | per-visitor daily ceiling |
| `CAROUSEL_RATE_PER_WEEK` | **∞** | **required** | per-visitor rolling-7-day ceiling — the free-tier cap |
| `CAROUSEL_DAILY_BUDGET` | 500 | **required** | hard cap on total paid decks per day |
| `CAROUSEL_RATE_DISABLED` | off | **refused when on** | switches off all four limits at once |

The two marked **required** are asserted at startup and the server will not boot
without them — `CAROUSEL_RATE_PER_WEEK` because its default is *no weekly cap at
all*, which makes the free tier unlimited, and `CAROUSEL_DAILY_BUDGET` so the
number that caps your bill is one somebody chose rather than one that defaulted.

The limiter keys on the real client IP (Caddy passes `X-Forwarded-For`). IP limits
are coarse for a public URL, so for a paid public deployment treat the daily budget
as your real safety net, and consider these follow-ups (not included here):
per-user accounts with quotas, and a shared (Redis) rate-limit store if you ever
run more than one instance — the store is a small pluggable interface
(`setRateLimitStore` in `src/lib/providers/ratelimit.ts`). See
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

Before you reach for that shared store: a shared limiter does **not** make this
app safe on more than one instance, and shipping it on its own makes things
worse. Read *[One replica, and
why](#one-replica-and-why-more-than-one-is-currently-a-bug)* first.

## Appendix — no-Docker alternative (Node + pm2 + nginx)

If you'd rather not use Docker:

```bash
npm ci
npm run build
# run the standalone server under a process manager
PORT=4321 pm2 start .next/standalone/server.js --name carousel
```

Front it with nginx for TLS (certbot) and, crucially, disable proxy buffering on
the streaming route or the progress/deck SSE will arrive all at once:

```nginx
location /api/generate {
    proxy_pass http://127.0.0.1:4321;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;          # required for SSE
    proxy_read_timeout 360s;      # decks with search take minutes
}
location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The Docker path handles all of this for you via Caddy, which is why it's the
recommended route.
