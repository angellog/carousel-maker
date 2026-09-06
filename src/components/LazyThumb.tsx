"use client";

import { useEffect, useRef, useState } from "react";
import SlideCanvas from "./SlideCanvas";
import type { Deck } from "@/lib/types";

interface Props {
  deck: Deck;
  presetId: string;
  paletteId?: string;
  index: number;
  scale?: number;
}

/**
 * Renders a preset thumbnail only once it scrolls into view. With 45 templates
 * on a phone, painting them all up front would stall the first interaction.
 */
export default function LazyThumb({ deck, presetId, paletteId, index, scale = 0.3 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ aspectRatio: "4 / 5" }} className="w-full overflow-hidden rounded-lg bg-black">
      {visible ? (
        <SlideCanvas deck={deck} presetId={presetId} paletteId={paletteId} index={index} scale={scale} />
      ) : null}
    </div>
  );
}
