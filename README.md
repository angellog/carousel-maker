# Carousel Maker

Give it a topic. It researches the web, writes the deck, typesets it, and hands
you post-ready PNGs — straight into the share sheet on a phone.

**Built for a phone.** One column, one primary action per screen, everything
reachable with a thumb. Swipe through the deck the same way your audience will.

Twelve carousel templates — one per winning format — **all drawn from vectors and type — no image-generation
model is involved anywhere.** Every texture, icon, chart, table, diagram, doodle
and 3D letter is produced from paths, gradients and procedural noise on a canvas.

---

## What it does

- **Make it great** — the [Art Director](src/lib/director) reads your topic and
  picks the template, palette, slide count, tone and voice, then writes the deck.
- **Five writer voices** — straight, mentor, contrarian, analyst, hype. The copy
  has a point of view, on the free tier too. ([voice](src/lib/content/voice.ts))
- **Bring your inspiration** — upload a screenshot; pure canvas math reads its
  palette and layout and matches the closest look, no image model. ([inspiration](src/lib/inspiration))
- **Honest research** — keyless (Wikipedia/Web) or your own key; never invents a
  statistic. See [PROVIDERS.md](docs/PROVIDERS.md).
- **Freemium** — genuinely useful and unwatermarked for free; Pro removes the cap
  and unlocks Inspiration + Brand Kit. See [PRODUCT.md](docs/PRODUCT.md).

**Docs:** [PRODUCT.md](docs/PRODUCT.md) · [DESIGN.md](docs/DESIGN.md) ·
[CREATORS.md](docs/CREATORS.md) · [PROVIDERS.md](docs/PROVIDERS.md) ·
[preset-research.md](docs/preset-research.md)

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:4321>.

It works with no configuration. Without an API key you get the built-in offline
writer — real layouts, placeholder words — so you can try every template
immediately. For researched copy, add a key:

```bash
cp .env.example .env.local
# then put your key in CAROUSEL_API_KEY
```

Use `CAROUSEL_API_KEY`, not `ANTHROPIC_API_KEY`. Next.js does not let a `.env`
file override a variable that is **already** in the process environment, and
some tools inject `ANTHROPIC_API_KEY` into the shell that starts the dev
server — so a key placed there can be silently ignored in favour of one you
did not choose. `CAROUSEL_API_KEY` is read first and always wins.

### Or paste a key in the app

You do not need a terminal. **Options → API key** takes a key on the device
you are holding, with a **Test key** button that makes a one-token call and
tells you plainly what is wrong — no credits, rejected key, wrong model, rate
limited — instead of leaving you guessing.

Key precedence is: the key typed in the app → `CAROUSEL_API_KEY` →
`ANTHROPIC_API_KEY`.

How the key is handled:

- Kept in that browser's `localStorage`, and nowhere else.
- Sent only to this app's own server, which forwards it to `api.anthropic.com`
  and keeps no copy — never written to disk, never logged, never echoed in a
  response. `sanitizeKey` rejects anything that is not a plausible `sk-ant-`
  key before it can be forwarded, and only the last four characters are ever
  displayed.
- Over plain `http://` on a shared network it travels unencrypted. Use
  `localhost`, or serve over HTTPS, if that matters to you.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :4321 |
| `npm run build` | Production build |
| `npm test` | Full suite (264 tests) |
| `npm run lint` | `tsc --noEmit` |
| `npm run samples` | Writes one PNG per template to `samples/` |

There is also a design-QA page at `/gallery` — every template rendered from the
same deck, so layout regressions are obvious. `/gallery?preset=keynote` shows
one template's whole deck.

---

## Modes — the brain behind the deck

The engine that writes a deck is two independent choices — **the Writer** (who
turns a topic into copy) and **the Research source** (where the facts come
from). Keeping them separate turns five apparent "modes" into one small grid.
You don't pick a mode; you configure a ladder, and the app resolves the best
available brain per request.

| Mode | Brain | Facts | Who pays | Enable |
|------|-------|-------|----------|--------|
| **Keyless free tier** | built-in template writer | Wikipedia / Web (keyless) | nobody | nothing — the default |
| **Bring-your-own-key** | Claude (user's key) | Claude's live web search | the user | paste a key in the app |
| **Hosted (our key)** | Claude (server key) | Claude's live web search | us | `CAROUSEL_API_KEY`, rate-limited |
| **Open-source brain** | any OpenAI-compatible model | Wikipedia / Web | us or nobody | `CAROUSEL_OSS_*` |
| **Live internet** | any writer | Web (Wikipedia + DuckDuckGo) | depends | research on + Web source |

Everything degrades safely: if a model errors or returns junk, the request falls
back to a real, sourced keyless deck rather than an error screen. Hosting behind
the server key is protected by a per-client + global rate limit so it can't be
drained. The full design, the config, and how to add a new brain are in
[`docs/PROVIDERS.md`](docs/PROVIDERS.md).

---

## How it works

```
topic ──► research + copywriting ──► Deck (JSON) ──► Preset.render() ──► Scene ──► canvas ──► PNG / ZIP
             (Claude + web search)     preset-agnostic    12 templates   display list   one painter
```

Four ideas carry the whole system:

**1. Content and design are fully separated.** A `Deck` is preset-agnostic
content. A `Preset` is a pure function `(ctx) => Scene`. Any deck renders
through any template, so switching templates never means regenerating copy.

**2. One painter, so the preview *is* the export.** `renderScene` draws a
`Scene` onto a canvas at any scale. The on-screen preview runs it at 1×; the
download runs the same call at 2× (2160×2700). There is no second rendering
path that could drift.

**3. Headlines get a box, not a font size.** `fitText` re-wraps and re-measures
at each trial size until the text fits its box. This is why every template survives
copy of any length — the test suite proves it with 300-word headlines.

**4. Nothing needs an image model.** `src/lib/render/` ships a vector icon set,
procedural film grain, gradient meshes, hand-drawn sketch strokes, ruled
notebook paper, barcodes, charts, chat bubbles, device frames and extruded 3D
type — plus a diagram layer with real data tables, ranked rows, tiered podiums,
isometric layer stacks, hub-and-spoke maps, labelled axes, component graphs and
bento mosaics. That is what fills the space an image would otherwise occupy.

---

## Project layout

```
src/lib/
  types.ts              Deck / Slide content model
  theme.ts              19 palettes, font tokens
  renderDeck.ts         Ties deck + preset + palette into a Scene
  render/
    scene.ts            Display-list node types
    text.ts             Markup parsing, measuring, wrapping, shrink-to-fit
    paint.ts            The canvas painter (the only thing that draws)
    ctx.ts              Preset render context + layout helpers
    decor.ts            Grain, grids, charts, chips, sketch strokes, badges
    props.ts            Sparkles, ruled paper, crop marks, 3D type, bubbles
    icons.ts            ~35 stroke-drawn icons + keyword→icon mapping
    diagrams.ts         Tables, ranked rows, podiums, layer stacks, mind maps,
                        axes, component graphs, panel grids, bento mosaics
  presets/            The 12 curated templates, one per winning format
    _shared.ts          The composition engine every template builds on
    dense.ts            statlist
    clean.ts            compare · datacard
    structured.ts       cheatsheet · numberlist · timeline
    editorial.ts        keynote · editorial · quote
    covers.ts           contents · colorpop · essay
  content/
    schema.ts           Validation + normalisation of model output
    prompt.ts           System/user prompts and the submit_deck tool schema
    offline.ts          Deterministic writer used when no API key is set
    research.ts         Keyless facts from Wikipedia's REST API
  content/errors.ts     Plain-language API failures; key sanitising + masking
  providers/            The two-axis brain: writers × research sources
    config.ts           resolveConfig(input, env) → which writer + research runs
    generate.ts         Orchestrator: research → write → template fallback
    ratelimit.ts        Spend protection for the modes where we pay
    writers/            claude · openai (any OSS/hosted) · template
    research/           wikipedia · web (Wikipedia + DuckDuckGo)
  export/index.ts       PNG, ZIP, native share sheet, caption.txt, project.json
components/             Mobile shell: swipeable deck, bottom sheets, lazy thumbs
```

---

## The 12 templates

Curated down from an earlier set of 45 to the formats that actually win a
carousel — the ones people save, share and screenshot — with one impeccable
template per format rather than a long tail of lookalikes. Information-dense
formats come first.

| Format (why it wins) | Template |
| --- | --- |
| **Data / one big number** — the most-saved format | `statlist` (rank · icon · label · figure), `datacard` (number + chart) |
| **Comparison / vs / before-after** — most comments & shares | `compare` (two-column ✓/✕) |
| **Listicle / tips** — scannable, high-save | `numberlist`, `cheatsheet` |
| **How-to / steps** — tutorials | `timeline` |
| **Table of contents / index** | `contents` |
| **Bold statement / hook** — earns the swipe | `keynote` |
| **Story / editorial / quotable line** | `editorial`, `essay`, `quote` |
| **Playful** — a colour per word | `colorpop` |

Each lists the fields it renders (`Preset.needs`) and a `brief` telling the
writer how to fill them, so the copy is shaped for the layout rather than poured
into it. The selection is grounded in current carousel research (saves/shares by
format); the earlier catalogue and how to retune a template are in
[`docs/preset-research.md`](docs/preset-research.md).

### Adding or changing a template

A preset is one object with a `render(ctx) => Scene` function. Nothing else in
the system knows about it, so you can rewrite one without touching the renderer,
the content model or the exporter.

```ts
export const mine: Preset = {
  id: "mine",
  name: "My Template",
  category: "bold",
  blurb: "One line for the picker.",
  defaultPalette: "midnight",
  palettes: ["midnight", "electric"],
  needs: ["kicker", "body", "bullets"],   // fields the writer should fill
  brief: "How the copy should be written for this template.",
  slideRange: [7, 10],
  render(c) {
    const box = bodyBox(c);
    const s = defaultShell(c, { titleMax: 96, bullet: "dash" });
    return scene(c, c.pal.bg, [...composeStack(c, s, box), ...D.footer(c)]);
  },
};
```

Add it to `PRESETS` in `src/lib/presets/index.ts`. The test suite picks it up
automatically and will hold it to the same standards as the others.

---

## Writing copy

Text fields accept inline markup, used sparingly:

| Markup | Effect |
| --- | --- |
| `**word**` | Accent colour — the one word carrying the idea |
| `==word==` | Marker highlight |
| `__word__` | Underline |
| `~~word~~` | Strike-through |

Headlines are capped at 15 words and trimmed if the model overshoots.

## Honesty

The offline writer never invents statistics. Where a template wants a number it
emits an obvious placeholder (`00%`, "Replace with a number you can source")
and the UI says the deck is a draft skeleton. When the model writes with search
enabled, it is told to cite only figures it actually found, and the sources it
consulted are shown in the studio and written into `caption.txt`.

## On a phone

The primary button is **Share all slides**: it renders every PNG and hands them
to the OS share sheet, so they go straight into Instagram without touching a
file manager. Browsers that cannot share files fall back to a ZIP download
automatically, and there is always a ⤓ button for the ZIP.

Editing happens in bottom sheets rather than side panels — Edit for the current
slide's fields, Style for the 12 templates plus colours and text size, Caption
for the caption, hashtags, sources and saving the project.

## What you get on download

```
topic-carousel.zip
├── 01.png … 09.png     2160×2700, 4:5
├── caption.txt         caption, hashtags, sources
├── project.json        re-openable in the app
└── README.txt
```

## Testing

264 tests. The ones that matter:

- **Every preset × every slide × every palette** renders without producing a
  single `NaN` coordinate — plus bare decks, 300-word headlines, one-character
  headlines, and two-slide decks.
- **Real canvas painting** via `@napi-rs/canvas`: bitmap dimensions, a genuine
  PNG at export resolution, byte-identical repeat renders, and a per-slide
  contrast check so a template can never ship as a blank or flat slab.
- **Text engine**: markup parsing, word-loss-free wrapping, shrink-to-fit, and a
  regression test for the letter-spacing bug that once made tightly-tracked
  headlines paint on top of themselves.
- **Model output tolerance**: arrays arriving as strings, stringified JSON
  arrays, lone objects where lists are expected, and double- or triple-escaped
  newlines and quotes.
- **Diagram primitives**: tables draw every cell and report the height they
  actually occupy, panels stop growing once their items fit, ranked rows stay
  inside their box, and arrowheads stay proportional on a full-width connector.
- **Credential handling**: `sanitizeKey` accepts a real key, strips quotes and
  whitespace, and rejects short keys, foreign prefixes, non-strings and values
  with embedded whitespace; `maskKey` never reveals more than four characters.
- **API failures**: the message a user sees for no credits, a rejected key, a
  rate limit, a missing model and a network drop — with unrecognised errors
  passed through rather than swallowed.
- **Provider resolution + spend protection**: the right brain is chosen for every
  key/env combination; the rate limiter allows up to each per-client and global
  limit then blocks, isolates clients, refunds on rollback, and never touches
  bring-your-own-key; the OSS adapter parses tool-calls and content-JSON alike
  and falls back cleanly; the `web` researcher merges Wikipedia + DuckDuckGo and
  survives either source failing; and a failed model still yields a sourced deck.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind 4 · Zod · JSZip ·
`@anthropic-ai/sdk` with server-side web search, plus any OpenAI-compatible
endpoint (Groq, Together, OpenRouter, Ollama…) for an open-source brain, and
keyless Wikipedia + DuckDuckGo research. No database, no image model, no canvas
library — the renderer is about 900 lines of plain Canvas 2D.
