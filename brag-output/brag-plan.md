# Brag Plan: Carousel Maker

## What is this app?
A phone-first tool that turns one topic into a finished, post-ready Instagram
carousel — it researches real facts, writes the deck, typesets it across 45
templates, and hands you the PNGs. The flex: **it uses no image-generation model
anywhere**, and it works with **no API key at all**.

## The angle
In a world where every "AI design tool" is a wrapper around an image model, this
one generates a polished, swipeable carousel where **every pixel is vectors,
type, and math** — and the free tier pulls **real, cited facts** with no key.
The video is a calm, confident product film with one contrarian gut-punch:
*45 templates, zero image models.* We earn it by showing the actual flow, then
stating the claim plainly.

## Hook (first 2-3 seconds)
A cursor types a real topic into the real field — **"James Webb Space
Telescope"** — on the app's near-black stage, mint caret blinking. One line
slams in and holds: **"One topic in."** No logo yet. The question the whole
video answers is on screen in two seconds: *what comes out?*

## Key moments (the middle)
- The mint **"Make carousel"** button gets a tap; the research log streams **real
  sources one by one** — "James Webb Space Telescope," "Sunshield," "Webb's First
  Deep Field" — under a small honest badge: **"No API key needed."**
- A phone frame swipes through the **finished deck**: cover → a fact slide *"It
  is the largest telescope in space"* with real small-print **"Source: James
  Webb Space Telescope."** The product *doing its thing*.
- The flex card: **"45 templates. Zero image models."** then *"Every pixel is
  vectors, type, and math."* A fan of tiny mint/blue template thumbnails.

## Outro / punchline
The phone taps **Download all**; PNGs (`01.png…`) drop into the OS share sheet.
Wordmark resolves: **"Carousel Maker — a topic in, a finished Instagram carousel
out."** Clean fade.

## User flow worth showing
The real happy path from `src/app/page.tsx`: **type a topic → tap "Make
carousel" → research streams real sources (keyless) → swipe the finished deck
with cited facts → "Download all" → post-ready PNGs.** Entry → key action →
result. This is the centerpiece; landing-page copy only frames it.

## Tone
- Preset: **app-store**
- Creative direction: confident phone-first product film with one contrarian
  flex — "no image model, anywhere."
- Interpretation: clean feature-card reveals and smooth wipes; longer holds on
  the two lines that matter (the hook and the flex); restraint everywhere else.
  The energy comes from crisp motion and real UI, never from flashing text.

## Format: landscape — 1920x1080
The phone UI is the hero object, centered on a dark stage — the app-store
convention for a mobile product, and it lets the deck swipe at native aspect.

## Duration: 20s (5 scenes)

## Visual identity (from the project)
- Background: **#0b0d10** (`--color-ink`, near-black); panels **#14171c**
- Accent: **#6ee7b7** (`--color-brand`, mint); secondary **#7dd3fc** (sky blue)
- Text: **#e9edf3** (`--color-text`); dim **#8d97a6**
- Display font: **Archivo Black** (chunky headers); also Playfair Display (serif)
- Body font: **Inter**; mono **JetBrains Mono**; hand **Caveat**
- Strongest visual element: the real compose screen (mint "Make carousel"
  button, dark field) and a swiping phone deck with cited fact slides.

## Share copy (draft)
One topic in, a finished Instagram carousel out — 45 templates, real cited
facts, and zero image models. No API key required.

## Audio direction
- Role: warm, clean corporate bed with motion-matched accents — polished, not busy.
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` (~120 BPM).
- Music treatment: start ~1.5s (let the first key-ticks breathe), moderate bed
  volume under UI sound, resolve/fade out over the last ~1.5s.
- Music cue guidance: preset read (see below).
- Audio-reactive treatment: subtle — a soft mint glow on the phone/button may
  breathe with the bed; no waveform bars, no gimmicks.
- SFX posture: sparse and motion-matched — key ticks on typing, one soft tap on
  the button, a light tick per streamed source, a short whoosh per deck swipe,
  a soft chime on download. Professional restraint; never a stack of sounds.
- Audio-coupled moments: the typed hook, the button tap, the one-by-one source
  reveal, the swipe sequence, the "Zero" flex hit, the download chime.
- Restraint rule: at most one clearly-audible SFX per beat; music never fights
  the UI sound; nothing loud on the fact-slide reads.

## Music cue guidance
- Track: `happy-beats-business-moves-vol-1` — preset present, ~120.19 BPM,
  beat grid ~0.5s apart across the 0–25s window.
- Strong-cue targets for major moments: **~16.02s** (flex card "Zero image
  models" lands), **~18.02s** (thumbnail fan settles), **~20.02s** (download
  chime / wordmark). These are `strong_beat` cues in the preset.
- Beat-grid windows for sequential reveals: stream the research sources on
  *every other* beat (~1.0s apart, not 0.5s) so each source name is readable —
  e.g. ~7.0s, ~8.0s, ~9.0s — then hold the full set.
- Restraint note: app-store tone — use cues to time reveals cleanly, not to make
  the video pulse. Readability and product clarity stay primary.

## Storyboard

### Scene 1 — Type the topic (hook) — 3s
Near-black stage (#0b0d10). The real compose field with placeholder "What's the
carousel about?"; a cursor types **"James Webb Space Telescope"** with a mint
(#6ee7b7) caret. Below, in Archivo Black, **"One topic in."** slams in and holds.
Sequential/interaction: yes — text is typed character-by-character into the field.
Audio intent: intimate, precise — the sound of a real keystroke starting a real task.
Audio-coupled idea: subtle key ticks on each typed character; music eases in under the last word.
Music: soft warm bed, just arriving.
Transition mood: clean → Scene 2

### Scene 2 — Generate, keyless (reveal) — 4s
The mint **"Make carousel"** button gets a simulated tap (button depresses). A
compact log streams under it: `↗ James Webb Space Telescope (web)`, then three
source rows arrive one by one — **• James Webb Space Telescope**, **• Sunshield**,
**• Webb's First Deep Field** — each with a small blue (#7dd3fc) dot. A quiet pill
reads **"No API key needed."** Hold the full set ~1s.
Sequential/interaction: yes — cursor taps the button, then 3 source rows reveal one by one (~1.0s apart), held after.
Audio intent: momentum — the task is running, and it's honest about needing no key.
Audio-coupled idea: one soft tap on the button; a light tick per source row on every other beat.
Music: bed settles into its groove.
Transition mood: smooth wipe → Scene 3

### Scene 3 — Swipe the finished deck (result) — 5s
A phone frame slides center-stage on the dark background. Inside, the finished
carousel swipes: **cover** "6 things worth knowing about **James Webb Space
Telescope**" → **fact slide** "It is the largest telescope in space" with real
small print **"Source: James Webb Space Telescope"** → one more fact slide. 2–3
slides swipe by at a readable pace (~1.2s each settled).
Sequential/interaction: yes — simulate left-swipes advancing the deck, one slide at a time.
Audio intent: satisfaction — this is the product delivering; let each slide land.
Audio-coupled idea: a short, soft whoosh matched to each swipe; no sound on the read itself.
Music: steady, confident.
Transition mood: soft wipe → Scene 4

### Scene 4 — The flex — 4s
Clean cut to the black stage. Big Archivo Black: **"45 templates."** then, a beat
later, **"Zero image models."** (the word *Zero* in mint). Sub-line in Inter:
**"Every pixel is vectors, type, and math."** A row of tiny template thumbnails
(mint/blue miniatures) fans out beneath and settles.
Sequential/interaction: yes — two-part headline reveal, then the thumbnail fan settling.
Audio intent: the confident thesis — one clean hit, then quiet.
Audio-coupled idea: a single low hit exactly on "Zero" (target ~16.02s strong cue); thumbnails settle by ~18.02s.
Music: bed swells slightly under the hit, then eases.
Transition mood: clean → Scene 5

### Scene 5 — Download & wordmark (outro) — 4s
Back to the phone: **"Download all"** gets tapped; a small stack of `01.png …
06.png` tiles drops into an OS-style share sheet. Then the wordmark resolves on
black: **Carousel Maker** (mint), with the line **"A topic in, a finished
Instagram carousel out."** Clean fade to #0b0d10.
Sequential/interaction: yes — tap "Download all," PNG tiles drop into the share sheet one by one.
Audio intent: resolution — the deliverable is in hand; the film exhales.
Audio-coupled idea: a soft chime on download (target ~20.02s strong cue); music resolves and fades over the last ~1.5s.
Music: final cadence, fade out.
Transition mood: soft fade → end

**Music mood for this video:** upbeat, clean, corporate-confident (not busy).
**Audio summary:** a warm 120-BPM bed eases in under a typed hook, carries crisp
motion-matched UI accents through the keyless generate and the deck swipe, lands
one low hit on "Zero image models," and resolves with a soft download chime as
the wordmark fades.
