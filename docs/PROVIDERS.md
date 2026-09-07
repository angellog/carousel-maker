# Providers — the "brain" behind a carousel

The engine that turns a topic into a finished deck isn't one choice, it's **two
independent ones**. Keeping them separate is what makes five apparent "modes"
collapse into a small grid you configure, instead of five code paths you
maintain.

```
Axis A — the Writer        Axis B — the Research source
  claude   (Anthropic)        none
  openai   (any OSS/hosted)    wikipedia   (keyless)
  template (no LLM)            web         (keyless: Wikipedia + DuckDuckGo)
```

Every mode a user can run in is just a point on that grid:

| Mode | Writer | Research | Who pays | How to enable |
|------|--------|----------|----------|---------------|
| **Keyless free tier** | `template` | `wikipedia` / `web` | nobody | nothing to set — the default |
| **Bring-your-own-key** | `claude` (user key) | Claude's own web search | the user | user pastes a key in the app |
| **Hosted (our key)** | `claude` (server key) | Claude's own web search | **us** | `CAROUSEL_API_KEY` (rate-limited) |
| **Open-source brain** | `openai` | `wikipedia` / `web` | us or nobody | `CAROUSEL_OSS_*` |
| **Live internet** | any writer | `web` | depends on writer | research on + Web source |

The code lives in [`src/lib/providers/`](../src/lib/providers):

```
providers/
  types.ts        Writer / Researcher interfaces + the event stream shape
  config.ts       resolveConfig(input, env) → which writer + research runs
  ratelimit.ts    spend protection for the modes where we pay
  generate.ts     the orchestrator: research → write → template fallback
  research/       wikipedia.ts, web.ts
  writers/        claude.ts, openai.ts, template.ts
```

## Writer precedence

`resolveConfig` picks exactly one writer, highest priority first:

1. **A key the user typed for this request** → Claude, billed to them (BYOK).
2. **A server Anthropic key** (`CAROUSEL_API_KEY` / `ANTHROPIC_API_KEY`) → Claude, billed to us.
3. **A configured OpenAI-compatible endpoint** (`CAROUSEL_OSS_BASE_URL` + `CAROUSEL_OSS_MODEL`) → open-source / hosted model.
4. **Nothing** → the keyless template writer.

Claude researches the live web itself (Anthropic's `web_search` tool), so it is
never handed pre-fetched facts. The `template` and `openai` writers cannot
browse, so when research is on the orchestrator runs a keyless researcher first
and grounds the prompt on those facts (and cites the sources).

## The research axis

- `wikipedia` — real, attributable facts from Wikipedia's keyless REST API. One
  clean source. A relevance filter keeps a namesake's biography (e.g. *James E.
  Webb* for the *James Webb Space Telescope*) from leaking into an on-topic deck.
- `web` — deeper and broader, still keyless: Wikipedia REST summaries **plus** the
  best article's extended plaintext intro (Wikipedia's classic `extracts` API,
  several times more than the summary) **plus** DuckDuckGo's Instant Answer
  abstract as an independent cross-check — all structured (no scraping),
  deduplicated. Measurably more facts than `wikipedia` on well-documented topics.

Chosen per request from the UI, or defaulted with `CAROUSEL_RESEARCH_SOURCE`.

## Adding a brain

A new writer is one file implementing `Writer` and one line in
`writers/index.ts`. A new researcher is one file implementing `Researcher` and
one line in `research/index.ts`. Nothing else changes — the orchestrator, the
route, and the UI are provider-agnostic. Most hosted models already work today
through the `openai` adapter by pointing `CAROUSEL_OSS_BASE_URL` at them.

## Spend protection (why "hosted, our key" is safe to expose)

A public endpoint holding *our* key is an unbounded bill: one script in a loop
spends real money with no ceiling. [`ratelimit.ts`](../src/lib/providers/ratelimit.ts)
is the guardrail. It applies **only** to `serverPaid` requests — a server
Anthropic key, or a hosted OSS key. Bring-your-own-key spends the user's money
and the template writer spends nobody's, so neither is limited.

Three independent limits, first one hit wins:

| Env | Default | Meaning |
|-----|---------|---------|
| `CAROUSEL_RATE_PER_MIN` | 5 | per-client burst ceiling |
| `CAROUSEL_RATE_PER_DAY` | 50 | per-client daily ceiling |
| `CAROUSEL_DAILY_BUDGET` | 500 | hard cap on total paid generations per day |
| `CAROUSEL_RATE_DISABLED` | 0 | `1` turns the limiter off (local dev) |

Clients are keyed by `x-forwarded-for` (then `x-real-ip` / `cf-connecting-ip`),
so it works behind Vercel/nginx/Cloudflare. A blocked request returns HTTP `429`
with a `Retry-After` header and a message that points the user at adding their
own key to keep going immediately.

### Multi-instance note

The default counter store is in-memory — correct and sufficient for a single
instance. Behind several instances, the counters should be shared or each
instance enforces its own slice of the budget. The store is a tiny interface
(`RateLimitStore`) so a Redis-backed implementation drops in via
`setRateLimitStore(...)` without touching anything else. Per-user accounts and
quotas (rather than per-IP) are the natural next layer when the hosted tier
grows past anonymous fair-use.

## Guarantees

- **Every path yields a renderable deck.** If a writer errors, returns nothing,
  or produces an invalid deck, the orchestrator falls back to the template
  writer — re-running research first, so even a failed Claude call still gives a
  real, sourced keyless deck rather than an error screen.
- **Keys are never persisted.** A request key is used for that one call and
  discarded — never written to disk, never logged, never echoed back.
- **Honesty in the UI.** Each deck carries `engine` / `engineKind` /
  `researchSource`, so the studio can say exactly which brain wrote it and what
  it drew on.
