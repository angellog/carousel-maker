"use client";

/**
 * Design QA surface: renders the same deck through every preset so layout
 * regressions are obvious at a glance. Not linked from the app UI.
 * Visit /gallery, or /gallery?preset=<id> to see one preset's whole deck.
 */

import { useEffect, useMemo, useState } from "react";
import SlideCanvas from "@/components/SlideCanvas";
import { writeOfflineDeck } from "@/lib/content/offline";
import { PRESETS, getPreset } from "@/lib/presets";

export default function Gallery() {
  const [only, setOnly] = useState<string | null>(null);
  const [slide, setSlide] = useState(1);

  // Deep-link support: /gallery?preset=retro3d&slide=2
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("preset");
    if (p) setOnly(p);
    const s = q.get("slide");
    if (s) setSlide(Math.max(0, Math.min(8, Number(s))));
  }, []);

  const decks = useMemo(
    () =>
      new Map(
        PRESETS.map((p) => [
          p.id,
          writeOfflineDeck({
            topic: "Why most morning routines fall apart by week three",
            audience: "people who keep restarting",
            handle: "@carouselmaker",
            preset: p,
            slideCount: 9,
          }),
        ]),
      ),
    [],
  );

  if (only) {
    const preset = getPreset(only);
    const deck = decks.get(only)!;
    return (
      <main className="p-6">
        <button className="btn mb-4 px-3 py-1.5 text-sm" onClick={() => setOnly(null)}>
          ← All templates
        </button>
        <h1 className="mb-4 text-xl font-bold">{preset.name}</h1>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {deck.slides.map((s, i) => (
            <div key={s.id}>
              <SlideCanvas deck={deck} presetId={only} index={i} scale={1} />
              <div className="mt-1 text-xs text-[var(--color-dim)]">
                {i + 1} · {s.role}
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-xl font-bold">All {PRESETS.length} templates</h1>
        <label className="flex items-center gap-2 text-sm text-[var(--color-dim)]">
          Slide
          <input
            type="range"
            min={0}
            max={8}
            value={slide}
            onChange={(e) => setSlide(Number(e.target.value))}
            className="accent-[var(--color-brand)]"
          />
          {slide + 1}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {PRESETS.map((p) => (
          <button key={p.id} className="text-left" onClick={() => setOnly(p.id)}>
            <SlideCanvas deck={decks.get(p.id)!} presetId={p.id} index={slide} scale={1} />
            <div className="mt-1 text-sm font-medium">{p.name}</div>
            <div className="text-xs text-[var(--color-dim)]">{p.id}</div>
          </button>
        ))}
      </div>
    </main>
  );
}
