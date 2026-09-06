"use client";

import { useMemo, useState } from "react";
import LazyThumb from "./LazyThumb";
import { CATEGORIES, PRESETS, getPreset } from "@/lib/presets";
import { PALETTES } from "@/lib/theme";
import type { Deck } from "@/lib/types";

interface Props {
  deck: Deck;
  presetId: string;
  paletteId?: string;
  typeScale?: number;
  onPreset: (id: string) => void;
  onPalette: (id: string) => void;
  onTypeScale?: (v: number) => void;
}

export default function StylePicker({
  deck,
  presetId,
  paletteId,
  typeScale = 1,
  onPreset,
  onPalette,
  onTypeScale,
}: Props) {
  const [cat, setCat] = useState<string>("all");
  const shown = useMemo(
    () => (cat === "all" ? PRESETS : PRESETS.filter((p) => p.category === cat)),
    [cat],
  );
  const active = getPreset(presetId);
  const thumbIndex = Math.min(1, deck.slides.length - 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          className="btn btn-sm shrink-0"
          style={cat === "all" ? { borderColor: "var(--color-brand)", color: "var(--color-brand)" } : undefined}
          onClick={() => setCat("all")}
        >
          All {PRESETS.length}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="btn btn-sm shrink-0"
            style={cat === c.id ? { borderColor: "var(--color-brand)", color: "var(--color-brand)" } : undefined}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((p) => {
          const on = p.id === presetId;
          return (
            <button key={p.id} onClick={() => onPreset(p.id)} className="text-left" title={p.blurb}>
              <div
                className="overflow-hidden rounded-xl border-2 transition"
                style={{ borderColor: on ? "var(--color-brand)" : "transparent" }}
              >
                <LazyThumb
                  deck={deck}
                  presetId={p.id}
                  paletteId={on ? paletteId : undefined}
                  index={thumbIndex}
                  scale={0.3}
                />
              </div>
              <div className="mt-1 truncate text-[13px] font-medium">{p.name}</div>
              <div className="truncate text-[11px] text-[var(--color-dim)]">{p.blurb}</div>
            </button>
          );
        })}
      </div>

      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">
          Colours
        </div>
        <div className="flex flex-wrap gap-2">
          {PALETTES.filter((p) => active.palettes.includes(p.id)).map((p) => {
            const on = (paletteId ?? active.defaultPalette) === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onPalette(p.id)}
                className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs"
                style={{ borderColor: on ? "var(--color-brand)" : "var(--color-edge)" }}
              >
                <span className="flex overflow-hidden rounded-full" style={{ width: 30, height: 14 }}>
                  <span style={{ background: p.bg, flex: 1 }} />
                  <span style={{ background: p.fg, flex: 1 }} />
                  <span style={{ background: p.accent, flex: 1 }} />
                </span>
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {onTypeScale && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">
            <span>Text size</span>
            <span>{Math.round(typeScale * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.82}
            max={1.18}
            step={0.02}
            value={typeScale}
            onChange={(e) => onTypeScale(Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
        </div>
      )}
    </div>
  );
}
