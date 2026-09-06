# Preset research — source templates

18 posts from the supplied link list were opened in a live Instagram session
(via `agent-reach` → Claude-in-Chrome, since the OpenCLI Browser Bridge backend
was not connected) and read visually. Each row records the visual system that
was actually observed, and the preset it became.

Every template below is reproducible with vectors + type only. No image model
is required anywhere in this app.

| # | Post | Account | Observed template | Preset |
|---|------|---------|-------------------|--------|
| 1 | DaWqzbPiFaT | rohit_beria | Dark green chalkboard, chalk hand-lettering, sketch doodles (book, bulb, sun), hand-drawn badge, tier list with arrows, rounded bottom banner strip | `chalkboard` |
| 2 | DcLaIHOj3W2 | social.cameo | Magenta gradient, chunky 3D extruded puffy type, sparkle stars | `retro3d` |
| 3 | DbdGRILDyMq | social.cameo | Cream, bold rounded display type with hard offset shadow, bordered inset panel, blue caption with accent phrase | `retro3d` |
| 4 | Dbre8P4jWGi | techwithsamiksha | Lavender ground, numbered circle badge, marker headline with boxed keyword, doodle brain, sub-sections, bottom callout strip | `pastelnote` |
| 5 | Da4S4_zjd_I | techwithsamiksha | Cream paper collage, tape-style label chips, marker outline word, card panels, sticky note, pill CTAs | `papercollage` |
| 6 | DcC0wOeCLrB | mastercode.sagar | Spiral notebook, handwritten ink title, underlined key terms, boxed definition, sketch icon row with arrows, circled page number | `notebook` |
| 7 | Dbnkf2VE0CW | the.graphiceffect | White studio deck, tiny mono meta (`04`, `©2025`), quiet headline, soft-shadow mockup card row, small studio footer | `studiomin` |
| 8 | DcLBMlhjsek | seb.ai | Parchment + fine grid, condensed caps headline with one orange word, exploded technical diagram, numbered callouts, icon flow footer | `schematic` |
| 9 | DcE2syNGFry | charlieautomates | Cream, mono header row, serif headline with hand-underlined accent line, floating dark UI card, orange 4-point sparkles | `warmserif` |
| 10 | DcOWgJWiaiD | aspirenest0b9 | Light ground, author chip, bold headline with colour-coded keywords, flat vector figure, fan-out arrows to UI cards | `flowchart` |
| 11 | Db193mZCACE | devopswithanu | Ruled notebook page, colour highlights on key terms, rounded callout box, device flow row (laptop → router → internet → server) | `notebook` |
| 12 | DcLfwXMEVW7 | the.alagent.guy | Near-black, starred banner strip, chalk headline with highlighted command, bordered rows each pairing copy with a mini data panel | `darkgrid` |
| 13 | DcP8FEKCZMo | thevikasroy | Solid yellow, black type, inverted black label bar, chevron sequence, generous leading | `flatcolor` |
| 14 | DboACGFCm3C | peterstewiestartup | Near-black, big index numeral, headline half on a yellow highlight bar, bordered mono prompt block, corner crop marks | `promptcard` |
| 15 | DcL07eeDE9W | web_development_legend | White reference card, avatar/handle chip, sectioned rows of `key` → description | `cheatsheet` |
| 16 | DbP92xMj_lo | okaashish | White, large headline with per-word colour coding, hand-drawn blob mascot, speech bubble, doodle cards | `doodlemascot` |
| 17 | DcJC-HDEkkl | startwithankitt | Near-black, mixed-scale display headline, yellow highlight bar, floating pastel glass pills, sparkles, handwritten arrow annotations | `glasschips` |
| 18 | DcXZn8TgaC8 | aiwithshivang | Ruled page, handwritten page tab, bordered section title bar, numbered square badges, `[bracket]` variables highlighted, flat illustration column | `numberlist` |

## Rounding out to 25

Seven further presets cover formats the list implies but that were not
sampled directly — they are standard carousel structures rather than an
imitation of any one account:

`keynote`, `editorial`, `swiss`, `duotone`, `quote`, `compare`, `datacard`,
`timeline`, `chatthread`.

## Re-tuning a preset

Each preset is a single `render(ctx) → Scene` function in `src/lib/presets/`.
To change one, edit that function only; the registry, content model, renderer
and exporter are untouched by preset changes.

---

# Round two — the remaining posts

The other 51 carousel posts from the list were read on 2026-09-01 (69 of ~71
total; the 5 reels are video, not carousels). The genres below were absent from
the first 25 presets, and most of them exist because the first round was
light on **information-dense** layouts.

| Post | Account | Observed template | Preset |
|------|---------|-------------------|--------|
| Dbp71gRDYLv | codedsoul_05 | Autonomy axis with icon nodes, then quadrant panels | `spectrum` |
| DcL6jKNiDqG | sapienship.lab | Long paragraph, bolded key clause, monoline drawing | `essay` |
| DcFhWNoCAag | mastercode.sagar | Central subject with radiating labelled icon nodes | `mindmap` |
| DbnephXDbZb, Db7wcsuk5Mg, DcFkVCODF3f | codedsoul_05, codeera.tech | Handbook cover: mini preview cards, "what's inside", by-the-numbers | `indexcover` |
| Dbpo7U0jUKC, DbZ25fjlHng, DbafR7DDzO- | codedsoul_05, seb.ai, olaconleyy | Component boxes wired with arrows; bottom process strip | `architecture` |
| Db2IWkvFXEE | raycfu | Beige ground, mixed serif/sans headline, flat geometric scene | `flatscene` |
| Db53ARwjSCM, DazvNhZiE1- | okaashish, handlytech | Numbered entry: rank circle, kicker, benefits, drawing | `rankcard` |
| Dccvn4rAuV9, Dcfp41WiYUk | _coder_star | Every headline word a different colour, doodle scatter | `colorpop` |
| DbsS6jjCCJp | i.lovecoding | Isometric numbered layer slabs with side annotations | `layerstack` |
| DbqeA9qD11a | qa_insights | Worksheet with a real comparison table (header row + columns) | `table` |
| DcWPznDjbwb | edusphereacademy1996 | Numbered panels around a central figure, closing question | `studysheet` |
| Dcgn1YhGb30, DcKqkY4k1ih | sarveshthakur.ai, mastercode.sagar | 3–5 node icon flow plus a benefit row | `processflow` |
| DcV5SUHFHxZ | web_pros | Mono meta, condensed numeral+title, side-by-side compare cards | `specsheet` |
| DcVl3qmoxKi | cse_aspirant_v | Chapter index: numbered circles, leader dots, page numbers | `contents` |
| DbK8b76lks3 | ibraviz.ai | Mosaic of mixed-size rounded cards, one holding the headline | `bento` |
| Daw1_LHjSfx, DbXGxEPkZ_4 | billionairetool, elevatemindhq | Dark ground, red numeral, icon rows on rules, quote bar | `motivation` |
| DbV6wvpjeQt | iklipse_ | Centred step title, caption, stacked panels with arrows | `steptutorial` |
| DbNtBB9jbef | successtheory.co | Serif headline + rotated handwritten note card + dash sections | `notecard` |
| Dbe-4qSlAht | seb.ai | Role-card column wired to a centre, bottom process strip | `rolegrid` |
| DbTcxpXDRPb | vgraphsinsta | Ranked pyramid: tiers of items with rank badges and values | `ranking` |
| Da4Ve93CTXs | aiwithshivang | White/red, big numeral, quarter-circle shapes, dot grids | `corpgeo` |
| Da_xjtZk1oW | health__education | Ranked rows: badge, icon, label, big percentage | `statlist` |
| DbgbuIHiDVq | edusphereacademy1996 | Vintage dossier: centred subject, numbered panels, timeline | `dossier` |
| Da90YZTFA9F, DbX-4htiKde | swiperightai, somesolutionsco | Sticker collage, outlined-box keyword, pill callouts | (folded into `papercollage`) |
| DcYVJY6jbCE, DcOWjFJj1eH | logo_fusion, qa_insights | Bubble type on a saturated grid; neon-on-black card row | (folded into `retro3d` / `chalkboard`) |

## Not reproducible without an image model

Several posts lean on photography or 3D renders — `DcgjbHxkVFh` (voxel vault),
`DbnnxxvFkqI` (3D mascot), `Da5rBkyDpy_` (product sketch board),
`Da-YinXFFWX` (product photo), `DbfUueFjf5M`, `DbaqBvUHyfo` (cutout portraits).
Their **layouts** were folded into existing presets; the imagery was not
copied, in line with the no-image-model rule.
