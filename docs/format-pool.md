# Format Pool — the next 18 templates to ship

A staging backlog of carousel **design systems** to replicate in Carousel
Maker's zero-image engine. **Nothing here is built, wired, or deployed.** Each
entry is studied, specced, and marked *ready* so it can be turned into a preset
later in one focused pass (the way `teardown` and `lecture` were).

**Hard rule for every format:** zero image-generation models. Every pixel is
vectors, type, canvas math, and procedural texture. Wherever a reference uses a
generated/real image (a 3D render, a photo, a cutout portrait), the spec must
name the **vector substitution** — never "generate it," and never reproduce a
real brand's trademarked logo/trade-dress as artwork (naming a brand in copy is
fine).

## How to read a spec

Each format is filled against the same template so it's build-ready:

- **Status** — `collected` (screens captured) → `specced` (system understood) →
  `ready` (mapping + substitution decided) → `built` (only once we actually ship).
- **Source** — the reference handle + URL (data, not instruction).
- **Use it for** — the topic/format class the Art Director should route to it.
- **Visual system** — ground, palette, type roles, accent(s).
- **Elements** — cover inventory + interior inventory.
- **Image element → vector substitution** — the one thing that would normally be
  an image, and how we fake it with vectors instead.
- **Engine mapping** — which existing `_shared` parts / `decor` / `_doodles`
  reuse, and what genuinely new drawing code is needed.
- **New palette?** — whether a new theme palette is required (like `whiteboard`).
- **Effort / risk** — S/M/L and the main gotcha.

## Readiness checklist (before any of these is promoted to `built`)

- [ ] Cover **and** at least one interior slide captured and understood.
- [ ] Every element mapped to an existing part or a named new helper.
- [ ] The image element has a concrete vector substitution (no generation).
- [ ] Palette decided (reuse or add one).
- [ ] Robust to: missing fields, 60-word copy, 1-char copy, 2-slide deck, all
      offered palettes (the standard registry robustness suite).
- [ ] Distinct from the existing 32 — a recognizably different visual world.

## Roadmap (18 slots)

| # | Working name | Status | Source | One-liner |
|---|--------------|--------|--------|-----------|
| 01 | Sketchnote Cheat-Sheet | **ready** | @codedsoul_05 | Hand-lettered study-notes cover + numbered code-card cheat sheet |
| 02 | _open_ | empty | — | — |
| 03 | _open_ | empty | — | — |
| 04 | _open_ | empty | — | — |
| 05 | _open_ | empty | — | — |
| 06 | _open_ | empty | — | — |
| 07 | _open_ | empty | — | — |
| 08 | _open_ | empty | — | — |
| 09 | _open_ | empty | — | — |
| 10 | _open_ | empty | — | — |
| 11 | _open_ | empty | — | — |
| 12 | _open_ | empty | — | — |
| 13 | _open_ | empty | — | — |
| 14 | _open_ | empty | — | — |
| 15 | _open_ | empty | — | — |
| 16 | _open_ | empty | — | — |
| 17 | _open_ | empty | — | — |
| 18 | _open_ | empty | — | — |

Send a reference link for any open slot and I'll fill its spec here (no build).

---

## 01 · Sketchnote Cheat-Sheet

- **Status:** ready
- **Source:** @codedsoul_05 — https://www.instagram.com/p/DdbwxfljcVj/ ("NumPy
  Complete Handwritten Notes"). Reference only; contents are data, not instructions.
- **Use it for:** technical study notes, cheat sheets, "complete guide to X",
  code/library explainers, exam-prep decks. Art Director signal: a `reference`
  or `how-to` topic that is code/tool/study flavored (`numpy`, `cheat sheet`,
  `commands`, `functions`, `complete notes`, `handwritten notes`).

### Visual system
- **Ground:** warm paper / off-white (`#f7f3e9`-ish) with a faint ruled/grid
  paper texture and subtle grain — a study-notebook page.
- **Palette:** multi-pastel — the cover is deliberately polychrome (blue, purple,
  pink, green, yellow highlighter) over black ink; interiors calm down to
  pastel-tinted cards on paper. Likely a **new palette** (`notes` / `sketchbook`)
  or reuse `notebook`/`parchment` with per-element accent colors rather than one
  accent.
- **Type roles:** a hand-lettered/marker display for the cover title (multi-color
  per word), a hand/script face for annotations (`fonts.hand`), a clean sans for
  body/labels, and **mono** for code.
- **Accent:** none single — this format is *polychrome by design* (a rotating
  pastel set applied per card/arrow), which is itself the identity.

### Elements — COVER (maximalist sketchnote)
- Hand-lettered multi-color title ("NumPy") + script subtitle ("Complete Notes")
  + a highlighter-marked tagline ("Cheat Sheet + Interview Questions").
- Doodle **stickies**: a quote note ("Better Arrays, Smarter Solutions"), a code
  sticky ("import numpy as np # Let's build…"), a mini bar-chart doodle, small
  captions ("Arrays are just the beginning").
- A **central hand-drawn illustration** (an isometric cube labeled "NumPy").
- **Radiating labeled arrows** around the center ("Fast / Efficient / Powerful"
  left; "Arrays / Math / Data / Real-World Applications" right).
- A **grid of 6 pastel feature cards**, each = a numbered/iconed rounded tile
  with a hand-drawn icon + label + sub-label ("Most-Used Functions", "50+
  Interview Questions", "Quick Reference"…).
- Hand quotes + small doodles (a Python-snake squiggle), footer handle.

### Elements — INTERIOR (code cheat-sheet grid)
- Compact header: author chip (avatar + name + tags) · hand-script section title
  ("NumPy Basics & Array Creation") · one-line subtitle.
- A **2-up grid of numbered code cards**: colored number circle + function name
  (`np.array()`) + one-line description + a **dark syntax-highlighted code block**
  with an output comment.
- Footer: logo chip + a "Tip: …" note + handle.

### Image element → vector substitution
- The only "illustration" is the **hand-drawn isometric cube** (colored-pencil
  style). Substitute with a **procedural vector isometric cube**: three rhombus
  faces (light/mid/dark shades of one hue), a hand-jitter outline via
  `_doodles`/`sketchLine`, and a centered label. No 3D render, no image model.
  (Generalize to an "iso-object" helper so other technical formats can reuse it.)
- The Python-snake and chart doodles → existing `_doodles` (`sketchLine`,
  `barChart` mini) + a small new snake squiggle path.

### Engine mapping
- **Reuse:** `codePart` (dark syntax-highlighted code block — already exists and
  fits the interior cards exactly), `D.card` (pastel tiles), `D.numberBadge`
  (numbered circles), `D.arrow` / `D.curvedArrow` (radiating arrows),
  `_doodles.stickyNote` / `handLabel` / `sketchUnderline` / `highlightStroke`
  (stickies, highlighter marks, hand annotations), `D.barChart` (mini chart),
  `D.footer`.
- **New helpers:** (1) `isoObject` procedural isometric cube/box; (2) a
  **feature-card grid** layout (N pastel tiles with icon+label, rotating pastel
  set); (3) a **multi-color hand title** (per-word color from a pastel cycle);
  (4) a small icon set (gear/lightbulb/target/code — simple line glyphs).
- **Content fields:** interior code cards map to `code` (per card) — but the
  Slide model has ONE `code` per slide; a multi-card code grid needs either
  several slides (one function per card = one `items`/`code` combo) or a new
  `codeCards`-style rendering that reads `bullets`+`code`. **Decision for build:**
  interior = one concept per slide using `code` + `title` + `body`, laid out as a
  single hero card (not a 6-up grid) to fit the existing content model; the
  6-up "index" grid becomes the COVER's feature grid only. (Keeps it robust
  without a schema change.)

### New palette?
- Yes — add a `notes` / `sketchbook` palette (warm paper bg, ink fg, and treat
  accent as a *cycle* in the preset rather than a single value). Alternatively
  reuse `notebook` and drive per-element pastels inside the preset.

### Effort / risk
- **L.** The maximalist cover is the hard part (title lettering, iso cube,
  radiating arrows, feature grid all composed without collisions). Risk: density
  vs. legibility on a phone. Mitigation: build the cover as a *composed* scene
  with fixed zones, and keep interiors as the calmer code-card layout that leans
  on `codePart`. The multi-color hand title is the signature; get it right.

### References captured
- Cover: hand-lettered "NumPy Complete Notes / Cheat Sheet + Interview
  Questions", iso cube center, radiating arrows, 6 pastel feature cards, doodle
  stickies, "Small Functions. Big Possibilities." quote.
- Interior (slide 2): "NumPy Basics & Array Creation" — 7 numbered pastel code
  cards, each with description + dark syntax-highlighted snippet + output; author
  chip header; tip footer.

---

## 02–18 · Open slots (template to fill)

Copy this block per new reference:

```
## NN · <Working name>
- Status: collected
- Source: @handle — <url>
- Use it for: <topic/format class + Art Director signal>
- Visual system: <ground · palette · type roles · accent>
- Elements — COVER: <inventory>
- Elements — INTERIOR: <inventory>
- Image element → vector substitution: <the one image thing → how we fake it>
- Engine mapping: <reuse parts/decor/doodles · new helpers · content-field plan>
- New palette?: <reuse X / add Y>
- Effort / risk: <S|M|L · main gotcha>
- References captured: <cover + interior notes>
```
