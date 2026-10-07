# Brag composition

The HyperFrames source for the launch video — the 16:9 `index.html` plus the
`square.html` / `vertical.html` crops, and the later `refreshed.html` and
`playbook.html` cuts. Hand-authored; nothing here is generated.

Previously `brag-output/composition/`. `brag-output/` is now ignored and holds
only renders (mp4/jpg) and snapshots, so the source moved here to stay tracked.

## Layout

| Path | Tracked? | What |
| --- | --- | --- |
| `*.html` | yes | the compositions |
| `hyperframes.json`, `package.json`, `meta.json` | yes | HyperFrames project manifests |
| `brag-plan.md`, `composition-brief.md` | yes | the brief these were built against |
| `share-copy*.txt` | yes | post copy per cut |
| `AGENTS.md`, `CLAUDE.md` | yes | agent instructions for editing these files |
| `assets/` | **no** | slides, thumbnails, music — see below |

`assets/` is ignored (`compositions/*/assets/` in `.gitignore`) but must sit
here, beside the HTML: every reference inside is relative (`assets/slides/…`),
so HyperFrames resolves them against the composition directory.

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

```sh
cd compositions/brag
npm run check     # validate
npm run dev       # preview
npm run render    # mp4
```

Renders land in the ignored `brag-output/`, not here.
