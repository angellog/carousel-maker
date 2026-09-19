import { mkdirSync, writeFileSync } from "node:fs";
import { Canvas, createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { describe, it } from "vitest";
import { getPreset } from "@/lib/presets";
import { makeCtx } from "@/lib/render/ctx";
import { renderScene, setCanvasFactory } from "@/lib/render/paint";
import { createMeasurer } from "@/lib/render/text";
import { FONT_FALLBACKS, getPalette, type FontSet } from "@/lib/theme";
import type { Deck } from "@/lib/types";

/**
 * Renders real, fully-formatted JWST carousel slides for the /brag video, using
 * the exact paint path the app's PNG export uses. Gated on RENDER_BRAG_SLIDES=1
 * so it never runs in the normal suite. Every field is real content (no
 * placeholders), so the template renders a finished-looking slide.
 */
const enabled = process.env.RENDER_BRAG_SLIDES === "1";
const OUT = process.env.BRAG_SLIDES_DIR || "brag-output/composition/assets/slides";
const PRESET = process.env.BRAG_SLIDES_PRESET || "keynote";

const DECK: Deck = {
  topic: "James Webb Space Telescope",
  angle: "The most powerful telescope ever launched — and the app that made this deck uses no image model.",
  audience: "curious beginners",
  handle: "@carouselmaker",
  caption: "",
  hashtags: [],
  sources: [
    { title: "James Webb Space Telescope", url: "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope" },
    { title: "Sunshield", url: "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope_sunshield" },
  ],
  slides: [
    {
      id: "s1",
      role: "cover",
      kicker: "Read this first",
      title: "**6** things worth knowing about the James Webb Space Telescope",
      body: "The largest, most powerful telescope ever launched into space.",
      note: "Drafted from public sources",
    },
    {
      id: "s2",
      role: "body",
      kicker: "Fact 01",
      title: "The largest telescope in space",
      body: "Its segmented mirror spans **6.5 metres** — nearly three times Hubble's.",
      stat: { value: "6.5 m", label: "Primary mirror", delta: "2.7× Hubble" },
      bullets: ["18 gold-coated beryllium segments", "Folded origami-style for launch", "Sees deeper into the infrared"],
      note: "Source: James Webb Space Telescope",
    },
    {
      id: "s3",
      role: "body",
      kicker: "Fact 02",
      title: "Colder than deep space",
      body: "A five-layer **sunshield** keeps its instruments near absolute zero.",
      stat: { value: "−223°C", label: "Instrument temperature" },
      bullets: ["Five tennis-court-sized layers", "Blocks the Sun, Earth and Moon", "Passive cooling — no refrigerant"],
      note: "Source: Sunshield",
    },
  ],
};

describe.skipIf(!enabled)("brag slide renderer", () => {
  it("writes real JWST carousel slides", () => {
    (globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
    const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
    setCanvasFactory(make);
    const measurer = createMeasurer(make);
    const fonts = { ...FONT_FALLBACKS } as FontSet;
    const preset = getPreset(PRESET);
    mkdirSync(OUT, { recursive: true });

    DECK.slides.forEach((slide, index) => {
      const ctx = makeCtx({
        deck: DECK,
        slide,
        index,
        total: DECK.slides.length,
        pal: getPalette(undefined, preset.defaultPalette),
        fonts,
        m: measurer,
        pad: preset.pad,
      });
      const canvas: Canvas = createCanvas(10, 10);
      renderScene(canvas as unknown as HTMLCanvasElement, preset.render(ctx), measurer, 1);
      writeFileSync(`${OUT}/slide-${index}.png`, canvas.toBuffer("image/png"));
    });
    console.log(`Wrote ${DECK.slides.length} brag slides (${PRESET}) to ${OUT}/`);
  });
});
