"use client";

import { useEffect, useRef, useState } from "react";
import { paintSlide } from "@/lib/renderDeck";
import type { Deck } from "@/lib/types";

let fontsPromise: Promise<void> | null = null;
function whenFontsReady(): Promise<void> {
  if (!fontsPromise) {
    fontsPromise =
      typeof document !== "undefined" && "fonts" in document
        ? document.fonts.ready.then(() => undefined).catch(() => undefined)
        : Promise.resolve();
  }
  return fontsPromise;
}

/** True once webfonts have loaded, so canvas text measures correctly. */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    whenFontsReady().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

export interface SlideCanvasProps {
  deck: Deck;
  presetId: string;
  paletteId?: string;
  typeScale?: number;
  index: number;
  /** Render resolution multiplier. 1 = 1080×1350. */
  scale?: number;
  className?: string;
  onError?: (message: string) => void;
}

export default function SlideCanvas({
  deck,
  presetId,
  paletteId,
  typeScale,
  index,
  scale = 1,
  className,
  onError,
}: SlideCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ready = useFontsReady();

  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    if (!deck.slides[index]) return;
    try {
      paintSlide(el, { deck, presetId, paletteId, typeScale }, index, scale);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A broken preset must never take the whole studio down.
      const ctx = el.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#2a0d0d";
        ctx.fillRect(0, 0, el.width, el.height);
        ctx.fillStyle = "#ff8080";
        ctx.font = "24px system-ui";
        ctx.fillText("Render error — see console", 32, 56);
      }
      console.error("Slide render failed", err);
      onError?.(message);
    }
  }, [deck, presetId, paletteId, typeScale, index, scale, ready, onError]);

  return <canvas ref={ref} className={`slide ${className ?? ""}`} aria-label={`Slide ${index + 1}`} />;
}
