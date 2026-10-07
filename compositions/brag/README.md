# Brag composition

The HyperFrames source for the launch video — the 16:9 `index.html` plus the
`compositions/square.html` / `compositions/vertical.html` crops, and the later
`compositions/refreshed.html` and `compositions/playbook.html` cuts.
Hand-authored; nothing here is generated.

Previously `brag-output/composition/`. `brag-output/` is now ignored and holds
only renders (mp4/jpg) and snapshots, so the source moved here to stay tracked.

## Layout

| Path | Tracked? | What |
| --- | --- | --- |
| `index.html` | yes | the root composition — the default render target |
| `compositions/*.html` | yes | the other four cuts, rendered with `-c` |
| `hyperframes.json`, `package.json`, `meta.json` | yes | HyperFrames project manifests |
| `brag-plan.md`, `composition-brief.md` | yes | the brief these were built against |
| `share-copy*.txt` | yes | post copy per cut |
| `AGENTS.md`, `CLAUDE.md` | yes | agent instructions for editing these files |
| `assets/` | **no** | slides, thumbnails, music — see below |

### Why only `index.html` sits at the root

A HyperFrames project has exactly one root composition. When several
root-level `.html` files carry `data-composition-id`, `check` fails with
`multiple_root_compositions` — the runtime may discover each as an entry point
and play all five music tracks at once. The four alternate cuts are not
sub-compositions of `index.html` (nothing mounts them via
`data-composition-src`); they are independent cuts, so they live in
`compositions/` and are rendered individually with `render -c`, the form the
CLI documents for exactly this case.

Keeping them there also restores lint coverage: while all five were at the
root, `check` deep-linted only `index.html` and said nothing about the other
four. Moving them surfaced a real error in `playbook.html` on the first run.

`assets/` is ignored (`compositions/*/assets/` in `.gitignore`) but must sit
at the project root, beside `index.html`: every reference inside the HTML is
relative (`assets/slides/…`) and HyperFrames resolves it against the project
directory, not the file's own directory — so the cuts under `compositions/`
share this one `assets/` tree and need no copy of their own.

## Rebuilding `assets/` from a clean clone

Two steps, in either order:

```sh
# 1. Slides — regenerated from the app's own paint path.
RENDER_BRAG_SLIDES=1 npx vitest run tests/brag-slides.test.ts

# 2. Thumbnails and music — no generator exists; pulled from git history.
compositions/brag/restore-assets.sh
```

The slide renderer writes to `compositions/brag/assets/slides` by default;
override with `BRAG_SLIDES_DIR`, and pick a template with `BRAG_SLIDES_PRESET`
(default `keynote`).

The six template thumbnails and the licensed music track are the one gap: they
were authored outside this repo and no script reproduces them. They are not
re-tracked because every byte is already permanently in history — the removal
commit (`10cf24f`) deliberately did not rewrite it — so `restore-assets.sh`
extracts them from `c797162` instead of adding 5 MB to the working tree.

## Rendering

**Restore `assets/` first** — see the section above. Every command below reads
the slides, thumbnails and music track, and `assets/` is not tracked, so on a
clean clone `check` reports `missing_local_asset` and `audio_src_not_found`
until you have run the two restore steps.

```sh
cd compositions/brag
npm run check     # validate every cut (walks the whole project directory)
npm run dev       # preview index.html
npm run render    # mp4 of index.html
```

`check`, `dev` and `render` default to `index.html`. To reach one of the other
four cuts, pass `-c` with its path relative to this directory:

```sh
npx hyperframes@0.8.51 render -c compositions/square.html
npx hyperframes@0.8.51 render -c compositions/vertical.html
npx hyperframes@0.8.51 render -c compositions/refreshed.html
npx hyperframes@0.8.51 render -c compositions/playbook.html
```

`npm run check` takes no `-c` — it validates the whole project directory in one
pass, so a single run covers all five cuts. `npm run dev` takes no `-c` either,
but the Studio lists all five and lets you switch between them.

Renders land in the ignored `brag-output/`, not here.

### Known warnings

`check` exits 0 but prints 10 style warnings: `timeline_track_too_dense` (one
per cut) and `nested_structure_needs_subcomposition` (×5, one per
`<section id="sN">` in `index.html`). Both ask for the scenes to be split into
mounted sub-compositions. That is a restructure of hand-authored, already-shipped
cuts, deliberately not done here. Errors must stay at zero.
