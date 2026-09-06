import { mkdirSync, writeFileSync } from "node:fs";
import { Canvas, createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { describe, it } from "vitest";
import { writeOfflineDeck } from "@/lib/content/offline";
import { PRESETS, getPreset } from "@/lib/presets";
import { makeCtx } from "@/lib/render/ctx";
import { renderScene, setCanvasFactory } from "@/lib/render/paint";
import { createMeasurer } from "@/lib/render/text";
import { FONT_FALLBACKS, getPalette, type FontSet } from "@/lib/theme";

/**
 * Writes one PNG per preset to `samples/` for eyeballing. Skipped by default;
 * run it with `npm run samples`. This is the same paint path the app's PNG
 * export uses, so the files here are exactly what a user would download.
 */

const enabled = process.env.RENDER_SAMPLES === "1";
const OUT = process.env.SAMPLES_DIR || "samples";
const SLIDE = Number(process.env.SAMPLES_SLIDE ?? 1);

describe.skipIf(!enabled)("sample renderer", () => {
  it("writes one PNG per preset", () => {
    (globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
    const make = (w: number, h: number) => createCanvas(w, h) as unknown as HTMLCanvasElement;
    setCanvasFactory(make);
    const measurer = createMeasurer(make);
    const fonts = { ...FONT_FALLBACKS } as FontSet;
    mkdirSync(OUT, { recursive: true });

    for (const preset of PRESETS) {
      const deck = writeOfflineDeck({
        topic: "Why most morning routines fall apart by week three",
        audience: "people who keep restarting",
        handle: "@carouselmaker",
        preset,
        slideCount: 9,
      });
      const index = Math.min(SLIDE, deck.slides.length - 1);
      const ctx = makeCtx({
        deck,
        slide: deck.slides[index],
        index,
        total: deck.slides.length,
        pal: getPalette(undefined, preset.defaultPalette),
        fonts,
        m: measurer,
        pad: preset.pad,
      });
      const canvas: Canvas = createCanvas(10, 10);
      renderScene(canvas as unknown as HTMLCanvasElement, preset.render(ctx), measurer, 1);
      writeFileSync(`${OUT}/${preset.id}.png`, canvas.toBuffer("image/png"));
    }
    console.log(`Wrote ${PRESETS.length} samples to ${OUT}/`);
  });
});
