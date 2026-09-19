# Hyperframes Composition Brief: Carousel Maker

## Objective
Create a short launch-style brag video for Carousel Maker.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `/Users/AngeloKiin/carousel-maker`
- Primary files read: `src/app/page.tsx`, `src/app/globals.css`, `README.md`, `src/lib/content/offline.ts`
- Product name: Carousel Maker
- Tagline / strongest claim: "A topic in, a finished Instagram carousel out." + "45 templates, no image-generation model anywhere."
- Key UI to recreate: the compose screen (dark field + mint "Make carousel" button), the streaming research log, and a phone swiping the finished deck with cited fact slides.
- Copy that must appear verbatim:
  - "What's the carousel about?" (field placeholder)
  - "Make carousel"
  - "No API key needed"
  - "Source: James Webb Space Telescope"
  - "45 templates."  /  "Zero image models."
  - "A topic in, a finished Instagram carousel out."

## Creative Direction
- Tone preset: app-store
- Creative direction: confident phone-first product film with one contrarian flex — "no image model, anywhere."
- Interpretation: clean feature-card reveals, smooth wipes, restraint; long holds only on the hook and the flex.
- Angle: In an AI-image world, this makes a polished carousel from vectors, type, and math — with real cited facts and no key.
- Hook: a cursor types "James Webb Space Telescope" → "One topic in."
- Outro / punchline: "Download all" → PNGs → wordmark "A topic in, a finished Instagram carousel out."
- Avoid: generic SaaS language, abstract filler, redesigning the product.

## Visual Identity
- Background: #0b0d10 (panels #14171c, edge #262c35)
- Text: #e9edf3 (dim #8d97a6)
- Accent: #6ee7b7 (mint); secondary #7dd3fc (sky blue)
- Display font: heavy system stack (system-ui 800/900) — avoid proprietary @font-face; body: system-ui/Inter fallback
- Visual references: dark compose field, mint pill button, source log rows, phone deck with "Source:" small print

## Storyboard
Use `brag-output/brag-plan.md` as the creative contract. Scene summary:
1. Type the topic — 3s — field types "James Webb Space Telescope"; "One topic in." holds
2. Generate, keyless — 4s — "Make carousel" tap; 3 source rows arrive; "No API key needed" pill
3. Swipe the deck — 5s — phone swipes cover → 2 cited fact slides
4. The flex — 4s — "45 templates. / Zero image models." + thumbnail fan
5. Download & wordmark — 4s — "Download all" → PNG tiles → wordmark, fade

## Audio
- Audio role: warm, clean corporate bed with restraint.
- Audio arc: bed eases in, carries the flow, resolves and fades under the wordmark.
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (~120.19 BPM).
- Music treatment: start at 0, moderate volume, fade out over the last ~1.5s.
- Music cue guidance: bundled preset present. Strong cue at ~16.02s (track time) locks the scene-5 payoff (download + wordmark reveal). Beat grid ~0.5s apart used to snap the scene-2 source rows on every other beat (~4.0s, ~5.0s, ~6.0s).
- Audio-reactive treatment: subtle if cheap (mint glow breathing); acceptable to skip on the first pass and document.
- Audio-coupled moments: typed hook, button tap, one-by-one source rows, deck swipes, "Zero" flex, download.
- SFX selection guidance: optional; if added, keep sparse and motion-matched (key ticks, one tap, soft ticks per source, swipe whooshes, a download chime). Music alone is acceptable for a clean first render.
- Audio files: music copied into `brag-output/composition/assets/music/`.

## Hyperframes Instructions
Author a standalone monolithic `index.html` per hyperframes-core. Single paused GSAP timeline registered on `window.__timelines["main"]`. Follow the lint gotchas (use `fromTo`, never tween `.clip` with autoAlpha, animate children, every `<audio>` has an id, no `crossorigin`, no proprietary `font-family` without `@font-face`). Beat-lock the scene-5 payoff to the ~16.02s strong cue (`// beat-locked`), snap scene-2 source rows to the beat grid (`// beat-grid`). Run `hyperframes check` before render; render to `../brag.mp4`.
