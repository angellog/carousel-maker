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

Then set your domain in `Caddyfile` (replace `carousel.example.com`).

`.env.production` is git-ignored — never commit it.

## 3. Deploy

```bash
docker compose up -d --build
```

That's it. Caddy fetches a TLS certificate for your domain and starts serving
`https://your-domain`. Check it:

```bash
docker compose ps          # both services "running"
docker compose logs -f app # generation logs
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

| Variable | Default | Meaning |
|----------|---------|---------|
| `CAROUSEL_RATE_PER_MIN` | 5 | per-visitor burst ceiling |
| `CAROUSEL_RATE_PER_DAY` | 50 | per-visitor daily ceiling |
| `CAROUSEL_DAILY_BUDGET` | 500 | hard cap on total paid decks per day |

The limiter keys on the real client IP (Caddy passes `X-Forwarded-For`). IP limits
are coarse for a public URL, so for a paid public deployment treat the daily budget
as your real safety net, and consider these follow-ups (not included here):
per-user accounts with quotas, and a shared (Redis) rate-limit store if you ever
run more than one instance — the store is a small pluggable interface
(`setRateLimitStore` in `src/lib/providers/ratelimit.ts`). See
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

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
