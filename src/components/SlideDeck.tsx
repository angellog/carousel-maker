"use client";

import { useEffect, useRef } from "react";
import SlideCanvas from "./SlideCanvas";
import type { Deck } from "@/lib/types";

interface Props {
  deck: Deck;
  presetId: string;
  paletteId?: string;
  typeScale?: number;
  index: number;
  onIndex: (i: number) => void;
}

/**
 * Horizontally swipeable deck using CSS scroll-snap — the same gesture the
 * carousel will have on Instagram, and no gesture library to fight with.
 */
export default function SlideDeck({ deck, presetId, paletteId, typeScale, index, onIndex }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const programmatic = useRef(false);

  // Keep the scroll position in step when the index changes from outside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (!child) return;
    const target = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
    if (Math.abs(el.scrollLeft - target) < 8) return;
    programmatic.current = true;
    el.scrollTo({ left: target, behavior: "smooth" });
    const t = setTimeout(() => {
      programmatic.current = false;
    }, 420);
    return () => clearTimeout(t);
  }, [index, deck.slides.length]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (programmatic.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < el.children.length; i++) {
          const c = el.children[i] as HTMLElement;
          const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        onIndex(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [onIndex]);

  return (
    <div>
      <div className="deck" ref={ref} aria-label="Carousel slides">
        {deck.slides.map((s, i) => (
          <div key={s.id} className="rounded-xl">
            <SlideCanvas
              deck={deck}
              presetId={presetId}
              paletteId={paletteId}
              typeScale={typeScale}
              index={i}
              scale={1}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {deck.slides.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="rounded-full transition-all"
            style={{
              width: i === index ? 20 : 7,
              height: 7,
              background: i === index ? "var(--color-brand)" : "var(--color-edge)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
