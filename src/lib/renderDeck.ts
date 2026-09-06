import { getPreset } from "./presets";
import { CANVAS_H, CANVAS_W, makeCtx } from "./render/ctx";
import { renderScene } from "./render/paint";
import type { Scene } from "./render/scene";
import { createMeasurer, type Measurer } from "./render/text";
import { getPalette, resolveFonts, type FontSet } from "./theme";
import type { Deck } from "./types";

export interface RenderOptions {
  deck: Deck;
  presetId: string;
  paletteId?: string;
  typeScale?: number;
  fonts?: FontSet;
  measurer?: Measurer;
}

let sharedMeasurer: Measurer | null = null;
export function getMeasurer(): Measurer {
  if (!sharedMeasurer) sharedMeasurer = createMeasurer();
  return sharedMeasurer;
}

export function buildScene(o: RenderOptions, index: number): Scene {
  const preset = getPreset(o.presetId);
  const slide = o.deck.slides[index];
  const pal = getPalette(o.paletteId, preset.defaultPalette);
  const ctx = makeCtx({
    deck: o.deck,
    slide,
    index,
    total: o.deck.slides.length,
    pal,
    fonts: o.fonts ?? resolveFonts(),
    m: o.measurer ?? getMeasurer(),
    typeScale: o.typeScale ?? 1,
    pad: preset.pad,
  });
  return preset.render(ctx);
}

export const SLIDE_W = CANVAS_W;
export const SLIDE_H = CANVAS_H;

/** Paint one slide into a canvas. `scale` 2 gives a 2160×2700 export. */
export function paintSlide(
  canvas: HTMLCanvasElement,
  o: RenderOptions,
  index: number,
  scale = 1,
): void {
  renderScene(canvas, buildScene(o, index), o.measurer ?? getMeasurer(), scale);
}

/** Webfonts must be ready before any canvas text is measured or drawn. */
export async function fontsReady(): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.ready;
  } catch {
    /* older browsers: fall through to system fallbacks */
  }
}
