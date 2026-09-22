# Brand — The Carousel Maker

Single source in code: [`src/lib/brand.ts`](../src/lib/brand.ts). Change the name,
tagline or colours there and every surface follows.

## The name

**The Carousel Maker.** A maker in the old sense: the clockmaker, the shoemaker,
the person who carved fairground carousels by hand. That is the promise: every
slide is typeset from type, vectors and math, and **nothing is generated**.

- The definite article makes it a name. "Carousel maker" by itself is just a search
  term, and every `carouselmaker.*` domain is taken. "*The* Carousel Maker" can be
  owned and still ranks for the phrase people search.
- Say it in full in headlines, the credit line and the share card. Use **Carousel
  Maker** (`BRAND.short`) only where space forces it (home-screen label).
- Never "CM", "TCM", or "Carousel AI".

## Lines

| Use | Line |
|---|---|
| Tagline | **Topic in. Carousel out.** |
| Promise (the wedge) | **Every slide typeset, never generated.** |
| Free-tier credit | *Typeset by The Carousel Maker. No AI images, just type & math. {domain}* |
| One-liner | The carousel maker that doesn't generate images: it researches, writes and typesets your post. |

"Typeset by", not "Made with". Every tool writes "made with". *Typeset* names the
craft, sounds like a compliment in someone else's caption, and quietly says "not
AI art". The credit is the main way the product spreads, so it gets the
most care.

## The mark

A fairground carousel drawn as a swipe carousel: a roof with a finial, a
scalloped valance, and three slide cards underneath (the active centre slide and
two neighbours peeking out). It's pure geometry, like everything else the
product draws. Components: `BrandMark`, `Wordmark` in
[`src/components/BrandMark.tsx`](../src/components/BrandMark.tsx).

- **Icon:** mint mark on an ink tile (`src/app/icon.svg`, `apple-icon.tsx`).
- **Wordmark:** a quiet italic serif *The* above a loud display **Carousel Maker**.
- Keep at least ¼ of the mark's width clear around it. Never put the mark on a
  generated image.

## Colour

| Token | Hex | Role |
|---|---|---|
| Ink | `#141c24` | Icon tile, share card, dark surfaces |
| Mint | `#34c79a` | The mark, the one accent |
| Paper | `#f7f8f8` | Light surfaces, type on ink |

In-app UI uses the OKLCH tokens in `globals.css` (`--color-brand` is this mint).

## Type

Display: Archivo Black. Accent: Playfair Display italic (only for "The" and
small editorial touches). UI: Inter.

## Voice

Plain, confident, a craftsman's pride without the hype. We say what the tool
does and what it refuses to do. No "revolutionary", no "AI-powered" as a
headline. "No AI images" is the headline.

## Surfaces checklist

- [x] Page title, description, Open Graph and Twitter cards (`layout.tsx`)
- [x] Share card 1200×630 (`opengraph-image.tsx`)
- [x] Favicon, Apple touch icon, PWA manifest
- [x] App header wordmark
- [x] Free caption credit, with a link once `NEXT_PUBLIC_SITE_URL` is set
- [ ] Register `thecarouselmaker.com` (looked free on 2026-09-22) and the matching IG handle
- [ ] Set `NEXT_PUBLIC_SITE_URL` in Railway once the domain serves the app
