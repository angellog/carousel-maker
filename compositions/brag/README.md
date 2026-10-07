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

Moving them did surface one real pre-existing error in `playbook.html` on the
first run. But it did **not** improve validation overall — it weakened it, and
that is the cost of this layout.

### `check` does not really validate the four cuts

`lintProject()` types files **by location**. It lints the root entry, then
walks `compositions/` and lints everything there with `isSubComposition: true`.
Under that flag eight rules return early — including
`gsap_timeline_not_registered` and `missing_timeline_registry`, **the two
detectors for the exact defect these cuts were just fixed for** (the missing
`window.__timelines` guard). No flag restores root-mode grading: `check` passes
no entry file, `lint` takes only a directory, and `lintProject`'s `entryFile`
parameter is never passed by any caller in `hyperframes@0.8.51`.

The browser passes do not cover the gap either. Delete
`window.__timelines["main"] = tl;` from `compositions/square.html` outright and
`npm run check` still reports **0 errors** across Lint, Runtime, Layout, Motion
and Contrast and prints `Check passed` — Runtime and Layout only ever exercise
the root `index.html`. The same file staged as a root `index.html` fails at
once with `gsap_timeline_not_registered`, severity **error**.

So a cut here whose animations never register renders a dead video that the
gate calls healthy. All four register correctly today and are verified by
render; what is lost is detection of **future** regressions. Until that is
restored, treat `render -c` output — not `npm run check` — as the real check on
these four files.

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
npm run check     # validates index.html fully; the four cuts only partly
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

`npm run check` takes no `-c`. It walks the whole project directory, so it
*reports on* all five cuts — but it grades the four under `compositions/` as
sub-compositions and its browser passes only exercise `index.html`, so a green
run is a far weaker claim for those four than for the root. Read *`check` does
not really validate the four cuts* above before trusting it. `npm run dev`
takes no `-c` either, but the Studio lists all five and lets you switch between
them.

Renders land in the ignored `brag-output/`, not here.

### The Studio rewrites composition source — commit the result

`npm run dev` does not just read these files. Both Studio preview routes stamp
`data-hf-id` onto every element and write the stamped HTML back over the
tracked source:

| What you do in Studio | Code path | File rewritten |
| --- | --- | --- |
| open the project (root preview) | `persistHfIdsIfNeeded` | `index.html` |
| switch to one of the four cuts | `pinSubCompHfIds` → `stampFileHfIds` (`O_RDWR`, then `ftruncateSync` + `writeSync`) | `compositions/<cut>.html` |

The rewrite also reserializes the file: `<!doctype>` → `<!DOCTYPE>`, void
elements lose their ` />`, boolean attributes gain `=""`. It is semantically
inert, and because each path only writes when the stamp would *add* ids, a file
that is already stamped is never touched again.

**So commit the stamped files; do not revert them.** Committing pins the ids and
stops the tree going dirty on every later preview. The five cuts here were
stamped this way — 290 `data-hf-id` attributes across 235 lines, in the commit
that moved them, which is also why git recorded those renames at only 54–62%
similarity.

This is the one Studio side-effect that touches *tracked* files. The two that
don't — the `.thumbnails/` cache and `snapshots/` — are covered by `.gitignore`
instead.

### Known warnings

`check` exits 0 but prints style warnings of two kinds, both asking for the
scenes to be split into mounted sub-compositions. That is a restructure of
hand-authored, already-shipped cuts, deliberately not done here. Errors must
stay at zero.

The honest total is **30**:

| Kind | Count | Where |
| --- | --- | --- |
| `timeline_track_too_dense` | 5 | one per cut |
| `nested_structure_needs_subcomposition` | 25 | one per `<section id="sN">` — 5 sections × 5 cuts |

A single `npm run check` prints only **10** of those 30. It walks the project
directory and grades the four relocated cuts as *sub-compositions*, which
exempts them from the root-mode nesting rule, so only `index.html`'s 5 nesting
warnings surface. But each cut is actually rendered as a root
(`render -c compositions/<cut>.html`), and linted that way it contributes its
own 5. Don't read the 10 as a clean bill for the other four cuts.

The same sub-composition grading also silences eight **error**-severity rules on
those four files — see *`check` does not really validate the four cuts* above.
The undercounted warnings are the visible half of one gap, not a separate quirk.
