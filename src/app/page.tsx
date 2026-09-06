"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApiKeyField, { loadStoredKey } from "@/components/ApiKeyField";
import Sheet from "@/components/Sheet";
import SlideCanvas from "@/components/SlideCanvas";
import SlideDeck from "@/components/SlideDeck";
import SlideEditor from "@/components/SlideEditor";
import StylePicker from "@/components/StylePicker";
import { writeOfflineDeck } from "@/lib/content/offline";
import {
  canShareFiles,
  captionFile,
  downloadAll,
  downloadBlob,
  downloadSlide,
  shareCarousel,
  slugify,
} from "@/lib/export";
import { missingFields } from "@/lib/content/schema";
import { getPreset, PRESETS } from "@/lib/presets";
import type { Deck, Slide } from "@/lib/types";

type Stage = "compose" | "working" | "studio";
type SheetId = null | "style" | "edit" | "caption" | "options";

interface LogLine {
  kind: "phase" | "search" | "source" | "notice" | "error";
  text: string;
  href?: string;
}

const TONES = ["Direct and practical", "Warm and personal", "Contrarian", "Analytical", "Playful"];
/** The rail on the home screen — a spread of looks, not the full 45. */
const FEATURED = ["statlist", "keynote", "numberlist", "notebook", "datatable", "chalkboard", "editorial", "bento"];

export default function Page() {
  const [stage, setStage] = useState<Stage>("compose");
  const [sheet, setSheet] = useState<SheetId>(null);

  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [handle, setHandle] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [slideCount, setSlideCount] = useState(8);
  const [research, setResearch] = useState(true);
  const [material, setMaterial] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Restore a key the user saved on this device.
  useEffect(() => setApiKey(loadStoredKey()), []);

  const [presetId, setPresetId] = useState(FEATURED[0]);
  const [paletteId, setPaletteId] = useState<string | undefined>(undefined);
  const [typeScale, setTypeScale] = useState(1);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number; verb: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preset = getPreset(presetId);
  const canShare = useMemo(() => canShareFiles(), []);

  const sampleDeck = useMemo(
    () =>
      writeOfflineDeck({
        topic: topic.trim() || "Building a habit that actually sticks",
        audience: audience || undefined,
        handle: handle || "@yourhandle",
        preset,
        slideCount,
      }),
    [topic, audience, handle, preset, slideCount],
  );
  const previewDeck = deck ?? sampleDeck;

  useEffect(() => setPaletteId(undefined), [presetId]);
  useEffect(() => {
    if (deck && index >= deck.slides.length) setIndex(Math.max(0, deck.slides.length - 1));
  }, [deck, index]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const generate = useCallback(async () => {
    if (!topic.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setStage("working");
    setLog([{ kind: "phase", text: research ? "Researching…" : "Writing…" }]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          topic, audience, handle, tone, slideCount, presetId, research,
          material: material.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `Request failed (${res.status})`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "phase") {
            const p = String(ev.phase);
            const text = p === "research" ? "Researching…" : p === "writing" ? "Writing…" : "Using the built-in writer…";
            setLog((l) => (l.at(-1)?.text === text ? l : [...l, { kind: "phase", text }]));
          } else if (ev.type === "search") {
            setLog((l) => [...l, { kind: "search", text: String(ev.query) }]);
          } else if (ev.type === "source") {
            setLog((l) => (l.some((x) => x.href === ev.url) ? l : [...l, { kind: "source", text: String(ev.title), href: String(ev.url) }]));
          } else if (ev.type === "notice") {
            setLog((l) => [...l, { kind: "notice", text: String(ev.message) }]);
          } else if (ev.type === "error") {
            setLog((l) => [...l, { kind: "error", text: String(ev.message) }]);
          } else if (ev.type === "deck") {
            setDeck(ev.deck as Deck);
            setIndex(0);
            setStage("studio");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setLog((l) => [...l, { kind: "error", text: err instanceof Error ? err.message : String(err) }]);
      setDeck(writeOfflineDeck({ topic, audience: audience || undefined, handle, preset, slideCount }));
      setStage("studio");
    }
  }, [topic, audience, handle, tone, slideCount, presetId, research, material, apiKey, preset]);

  const updateSlide = (next: Slide) =>
    setDeck((d) => (d ? { ...d, slides: d.slides.map((s, i) => (i === index ? next : s)) } : d));

  const addSlide = () => {
    setDeck((d) => {
      if (!d) return d;
      const slides = [...d.slides];
      slides.splice(index + 1, 0, { id: `s${Date.now()}`, role: "body", title: "New slide", body: "" });
      return { ...d, slides };
    });
    setIndex((i) => i + 1);
  };

  const removeSlide = () => {
    setDeck((d) => (d && d.slides.length > 3 ? { ...d, slides: d.slides.filter((_, i) => i !== index) } : d));
    setIndex((i) => Math.max(0, i - 1));
  };

  const moveSlide = (dir: -1 | 1) => {
    setDeck((d) => {
      if (!d) return d;
      const to = index + dir;
      if (to < 0 || to >= d.slides.length) return d;
      const slides = [...d.slides];
      [slides[index], slides[to]] = [slides[to], slides[index]];
      return { ...d, slides };
    });
    setIndex((i) => Math.min(Math.max(0, i + dir), (deck?.slides.length ?? 1) - 1));
  };

  const opts = deck ? { deck, presetId, paletteId, typeScale } : null;

  const runExport = async (mode: "share" | "zip" | "one") => {
    if (!opts) return;
    const verb = mode === "share" ? "Preparing" : "Exporting";
    setBusy({ done: 0, total: deck!.slides.length, verb });
    try {
      if (mode === "one") {
        await downloadSlide(opts, index);
        flash("Slide saved");
      } else if (mode === "share") {
        const r = await shareCarousel(opts, (p) => setBusy({ ...p, verb }));
        if (r === "unsupported") {
          await downloadAll(opts, (p) => setBusy({ ...p, verb: "Exporting" }));
          flash("Saved as a .zip");
        } else if (r === "shared") {
          flash("Shared");
        }
      } else {
        await downloadAll(opts, (p) => setBusy({ ...p, verb }));
        flash("Saved as a .zip");
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  const loadProject = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as {
        presetId?: string; paletteId?: string; typeScale?: number; deck?: Deck;
      };
      if (!d.deck?.slides?.length) throw new Error("No slides in that file");
      setDeck(d.deck);
      if (d.presetId) setPresetId(d.presetId);
      setPaletteId(d.paletteId);
      setTypeScale(d.typeScale ?? 1);
      setIndex(0);
      setStage("studio");
    } catch (err) {
      flash(`Could not open: ${(err as Error).message}`);
    }
  };

  /* ------------------------------ compose ----------------------------- */

  if (stage === "compose" || stage === "working") {
    const working = stage === "working";
    return (
      <main className="app">
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-6">
            <h1 className="text-2xl font-bold tracking-tight">Carousel Maker</h1>
            <p className="mt-1 text-sm text-[var(--color-dim)]">
              A topic in, a finished Instagram carousel out.
            </p>

            <textarea
              className="field mt-5"
              rows={3}
              autoFocus
              disabled={working}
              placeholder="What's the carousel about?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void generate();
              }}
            />

            <div className="mt-5 flex items-baseline justify-between">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">
                Style
              </span>
              <button
                className="text-sm underline underline-offset-4"
                onClick={() => setSheet("style")}
                disabled={working}
              >
                All {PRESETS.length}
              </button>
            </div>
          </div>

          <div className="rail mt-2 pb-1">
            {FEATURED.map((id) => {
              const p = getPreset(id);
              const on = p.id === presetId;
              return (
                <button key={id} onClick={() => setPresetId(id)} disabled={working} className="w-[104px] text-left">
                  <div
                    className="overflow-hidden rounded-xl border-2"
                    style={{ borderColor: on ? "var(--color-brand)" : "transparent" }}
                  >
                    <SlideCanvas
                      deck={previewDeck}
                      presetId={id}
                      paletteId={on ? paletteId : undefined}
                      index={1}
                      scale={0.16}
                    />
                  </div>
                  <div className="mt-1 truncate text-[12px]">{p.name}</div>
                </button>
              );
            })}
          </div>

          <div className="px-4 pt-4">
            <button className="btn w-full justify-between" onClick={() => setSheet("options")} disabled={working}>
              <span>Options</span>
              <span className="text-sm text-[var(--color-dim)]">
                {slideCount} slides · {research ? "research" : "no research"}
                {apiKey ? " · own key" : ""}
              </span>
            </button>

            {log.length > 0 && (
              <div className="scroll-thin mt-4 max-h-52 overflow-y-auto rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-3 text-sm">
                {log.map((l, i) => (
                  <div key={i} className="flex gap-2 py-0.5">
                    <span
                      className={
                        l.kind === "error" ? "text-red-400"
                        : l.kind === "search" ? "text-[var(--color-brand-2)]"
                        : l.kind === "notice" ? "text-amber-300"
                        : "text-[var(--color-dim)]"
                      }
                    >
                      {l.kind === "search" ? "\u2197" : l.kind === "source" ? "\u2022" : l.kind === "error" ? "!" : "\u00b7"}
                    </span>
                    {l.href ? (
                      <a className="truncate underline underline-offset-2" href={l.href} target="_blank" rel="noreferrer">
                        {l.text}
                      </a>
                    ) : (
                      <span className={l.kind === "error" ? "text-red-300" : undefined}>{l.text}</span>
                    )}
                  </div>
                ))}
                {working && <div className="dot-pulse py-1 text-[var(--color-dim)]">working…</div>}
              </div>
            )}
          </div>
        </div>

        <div className="dock">
          {working ? (
            <button
              className="btn w-full"
              onClick={() => {
                abortRef.current?.abort();
                setStage("compose");
              }}
            >
              Cancel
            </button>
          ) : (
            <>
              <button className="btn btn-primary flex-1" onClick={() => void generate()} disabled={!topic.trim()}>
                Make carousel
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()} aria-label="Open a saved project">
                Open
              </button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void loadProject(f);
            e.target.value = "";
          }}
        />

        <Sheet open={sheet === "style"} title="Style" onClose={() => setSheet(null)}>
          <StylePicker
            deck={previewDeck}
            presetId={presetId}
            paletteId={paletteId}
            onPreset={setPresetId}
            onPalette={setPaletteId}
          />
        </Sheet>

        <Sheet open={sheet === "options"} title="Options" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-4 pt-1">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">Audience</span>
              <input className="field mt-1" placeholder="founders, students…" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">Your handle</span>
              <input className="field mt-1" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">Tone</span>
              <select className="field mt-1" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">Slides</span>
                <span className="text-sm">{slideCount}</span>
              </div>
              <input
                type="range" min={4} max={12} value={slideCount}
                onChange={(e) => setSlideCount(Number(e.target.value))}
                className="mt-2 w-full accent-[var(--color-brand)]"
              />
              <div className="text-[11px] text-[var(--color-dim)]">
                {preset.name} suits {preset.slideRange[0]}–{preset.slideRange[1]}
              </div>
            </div>
            <label className="tap flex items-center gap-3 text-sm">
              <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="size-5 accent-[var(--color-brand)]" />
              Search the web first
            </label>
            <ApiKeyField value={apiKey} onChange={setApiKey} />

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">
                Source material (optional)
              </span>
              <textarea
                className="field mt-1" rows={5}
                placeholder="Paste a transcript or your notes to write from."
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </label>
          </div>
        </Sheet>

        {toast && <Toast text={toast} />}
      </main>
    );
  }

  /* ------------------------------- studio ----------------------------- */

  if (!deck || !opts) return null;
  const slide = deck.slides[index];
  // Fields this template renders that the current deck never filled in.
  const missing = missingFields(deck, preset.needs).filter(
    (f) => !["kicker", "note", "body"].includes(f),
  );

  return (
    <main className="app">
      <header className="flex flex-none items-center gap-2 px-4 pt-4">
        <button className="btn btn-sm" onClick={() => setStage("compose")} aria-label="Back">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{deck.topic}</div>
          <div className="truncate text-xs text-[var(--color-dim)]">
            {preset.name} · {index + 1} of {deck.slides.length}
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => setSheet("style")}>Style</button>
      </header>

      {deck.offline && (
        <p
          className="mx-4 mt-3 rounded-lg px-3 py-2 text-xs"
          style={
            deck.enriched
              ? { background: "rgba(125,211,252,0.12)", color: "var(--color-brand-2)" }
              : { background: "rgba(245,158,11,0.1)", color: "#fcd34d" }
          }
        >
          {deck.enriched
            ? "Drafted from public sources (Wikipedia) — free, no key. Facts are real; tighten the wording, then add your angle."
            : "Draft skeleton — the layout is real, the words are placeholders. Tap Edit to replace them, or add an API key for AI-written copy."}
        </p>
      )}

      <div className="flex-1 overflow-y-auto py-4">
        <SlideDeck
          deck={deck}
          presetId={presetId}
          paletteId={paletteId}
          typeScale={typeScale}
          index={index}
          onIndex={setIndex}
        />

        <div className="mt-5 grid grid-cols-3 gap-2 px-4">
          <button className="btn" onClick={() => setSheet("edit")}>Edit</button>
          <button className="btn" onClick={() => setSheet("caption")}>Caption</button>
          <button className="btn" onClick={() => void runExport("one")} disabled={!!busy}>
            This slide
          </button>
        </div>
      </div>

      <div className="dock">
        <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => void runExport(canShare ? "share" : "zip")}>
          {busy ? `${busy.verb} ${busy.done}/${busy.total}…` : canShare ? "Share all slides" : "Download all"}
        </button>
        {canShare && (
          <button className="btn" disabled={!!busy} onClick={() => void runExport("zip")} aria-label="Download as zip">
            ⤓
          </button>
        )}
      </div>

      <Sheet
        open={sheet === "edit"}
        title={`Slide ${index + 1} of ${deck.slides.length}`}
        onClose={() => setSheet(null)}
        footer={
          <div className="grid grid-cols-4 gap-2">
            <button className="btn btn-sm" onClick={() => moveSlide(-1)} disabled={index === 0}>← Move</button>
            <button className="btn btn-sm" onClick={() => moveSlide(1)} disabled={index === deck.slides.length - 1}>Move →</button>
            <button className="btn btn-sm" onClick={addSlide}>+ Add</button>
            <button className="btn btn-sm text-red-300" onClick={removeSlide} disabled={deck.slides.length <= 3}>Delete</button>
          </div>
        }
      >
        <SlideEditor slide={slide} presetId={presetId} onChange={updateSlide} />
      </Sheet>

      <Sheet open={sheet === "style"} title="Style" onClose={() => setSheet(null)}>
        {missing.length > 0 && (
          <div className="mb-3 rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel-2)] p-3">
            <p className="text-sm">
              <strong>{preset.name}</strong> shows {missing.join(", ")}, which this deck doesn&apos;t
              have yet — so the slides look thin.
            </p>
            <button
              className="btn btn-sm mt-2 w-full"
              onClick={() => {
                setSheet(null);
                void generate();
              }}
            >
              Rewrite the copy for this template
            </button>
          </div>
        )}
        <StylePicker
          deck={deck}
          presetId={presetId}
          paletteId={paletteId}
          typeScale={typeScale}
          onPreset={setPresetId}
          onPalette={setPaletteId}
          onTypeScale={setTypeScale}
        />
      </Sheet>

      <Sheet
        open={sheet === "caption"}
        title="Caption"
        onClose={() => setSheet(null)}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn"
              onClick={async () => {
                await navigator.clipboard.writeText(captionFile(deck));
                flash("Caption copied");
              }}
            >
              Copy caption
            </button>
            <button
              className="btn"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ version: 1, presetId, paletteId, typeScale, deck }, null, 2)], {
                  type: "application/json",
                });
                downloadBlob(blob, `${slugify(deck.topic)}-project.json`);
                flash("Project saved");
              }}
            >
              Save project
            </button>
          </div>
        }
      >
        <textarea
          className="field text-sm"
          rows={9}
          value={deck.caption}
          onChange={(e) => setDeck({ ...deck, caption: e.target.value })}
        />
        <input
          className="field mt-2 text-sm"
          value={deck.hashtags.join(" ")}
          onChange={(e) => setDeck({ ...deck, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
        />
        {deck.sources.length > 0 && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">Sources</div>
            <ul className="flex flex-col gap-2 text-sm">
              {deck.sources.map((s) => (
                <li key={s.url}>
                  <a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Sheet>

      {toast && <Toast text={toast} />}
    </main>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2 rounded-full bg-[var(--color-panel-2)] px-4 py-2 text-sm shadow-lg"
      style={{ bottom: "calc(84px + var(--safe-b))", border: "1px solid var(--color-edge)" }}
      role="status"
    >
      {text}
    </div>
  );
}
