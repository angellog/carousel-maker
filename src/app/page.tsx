"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ApiKeyField, { loadStoredKey } from "@/components/ApiKeyField";
import InspirationSheet from "@/components/InspirationSheet";
import Sheet from "@/components/Sheet";
import SlideCanvas from "@/components/SlideCanvas";
import SlideDeck from "@/components/SlideDeck";
import SlideEditor from "@/components/SlideEditor";
import StylePicker from "@/components/StylePicker";
import ThemeToggle from "@/components/ThemeToggle";
import { useTurnstile } from "@/components/useTurnstile";
import UpgradeSheet from "@/components/UpgradeSheet";
import { writeOfflineDeck } from "@/lib/content/offline";
import { VOICES, getVoice } from "@/lib/content/voice";
import { directDeck } from "@/lib/director";
import type { Inspiration } from "@/lib/inspiration";
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
import { can, quotaState, type PlanId, type Feature } from "@/lib/plan";
import { PALETTE_BY_ID } from "@/lib/theme";
import type { Deck, Slide } from "@/lib/types";

type Stage = "compose" | "working" | "studio";
type SheetId = null | "style" | "edit" | "caption" | "options" | "voice" | "inspiration" | "upgrade";

interface LogLine {
  kind: "phase" | "search" | "source" | "notice" | "error";
  text: string;
  href?: string;
}

const TONES = ["Direct and practical", "Warm and personal", "Contrarian", "Analytical", "Playful"];
/** The rail on the home screen — a spread of looks, not all 12. */
const FEATURED = ["statlist", "datacard", "numberlist", "compare", "timeline", "keynote", "editorial", "colorpop"];

/* ------------------------- local persistence ------------------------- */

/** ISO-week key (e.g. "2026-W38") — the free quota resets weekly. */
function periodKey(d = new Date()): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function loadPlan(): PlanId {
  try {
    return localStorage.getItem("cm-plan") === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}
function loadUsage(): number {
  try {
    const raw = JSON.parse(localStorage.getItem("cm-usage") || "{}") as { key?: string; n?: number };
    return raw.key === periodKey() ? raw.n ?? 0 : 0;
  } catch {
    return 0;
  }
}
interface BrandKit {
  handle?: string;
  voiceId?: string;
  paletteId?: string;
}
function loadBrand(): BrandKit | null {
  try {
    const raw = localStorage.getItem("cm-brand");
    return raw ? (JSON.parse(raw) as BrandKit) : null;
  } catch {
    return null;
  }
}

export default function Page() {
  const [stage, setStage] = useState<Stage>("compose");
  const [sheet, setSheet] = useState<SheetId>(null);

  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [handle, setHandle] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [voiceId, setVoiceId] = useState<string>("straight");
  const [slideCount, setSlideCount] = useState(8);
  const [countTouched, setCountTouched] = useState(false);
  const [research, setResearch] = useState(true);
  const [researchSource, setResearchSource] = useState<"wikipedia" | "web">("wikipedia");
  const [material, setMaterial] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [plan, setPlan] = useState<PlanId>("free");
  const [usage, setUsage] = useState(0);
  const [upsell, setUpsell] = useState<Feature | undefined>(undefined);

  useEffect(() => {
    setApiKey(loadStoredKey());
    const p = loadPlan();
    setPlan(p);
    setUsage(loadUsage());
    // Pro: apply a saved Brand Kit as the defaults for this session.
    if (p === "pro") {
      const b = loadBrand();
      if (b) {
        if (b.handle) setHandle(b.handle);
        if (b.voiceId) { setVoiceId(b.voiceId); setTone(getVoice(b.voiceId).tone); }
        if (b.paletteId) setPaletteId(b.paletteId);
      }
    }
  }, []);

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
  const isPro = plan === "pro";
  const quota = quotaState(plan, usage);
  const { getToken: getTurnstileToken } = useTurnstile();

  const sampleDeck = useMemo(
    () =>
      writeOfflineDeck({
        topic: topic.trim() || "Building a habit that actually sticks",
        audience: audience || undefined,
        handle: handle || "@yourhandle",
        preset,
        slideCount,
        voiceId,
      }),
    [topic, audience, handle, preset, slideCount, voiceId],
  );
  const previewDeck = deck ?? sampleDeck;

  /** Live, deterministic art direction for the current topic (the magic hint). */
  const suggestion = useMemo(() => {
    const t = topic.trim();
    if (t.length < 3) return null;
    return directDeck({
      topic: t,
      audience: audience || undefined,
      material: material.trim() || undefined,
      slideCount: countTouched ? slideCount : undefined,
    });
  }, [topic, audience, material, countTouched, slideCount]);

  useEffect(() => setPaletteId(undefined), [presetId]);
  useEffect(() => {
    if (deck && index >= deck.slides.length) setIndex(Math.max(0, deck.slides.length - 1));
  }, [deck, index]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const bumpUsage = useCallback(() => {
    setUsage((n) => {
      const next = n + 1;
      try {
        localStorage.setItem("cm-usage", JSON.stringify({ key: periodKey(), n: next }));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setPro = (on: boolean) => {
    setPlan(on ? "pro" : "free");
    try {
      localStorage.setItem("cm-plan", on ? "pro" : "free");
    } catch {
      /* ignore */
    }
  };

  const openUpgrade = (feature?: Feature) => {
    setUpsell(feature);
    setSheet("upgrade");
  };

  const saveBrand = () => {
    try {
      localStorage.setItem("cm-brand", JSON.stringify({ handle, voiceId, paletteId }));
      flash("Brand Kit saved");
    } catch {
      flash("Couldn't save on this device");
    }
  };
  const clearBrand = () => {
    try {
      localStorage.removeItem("cm-brand");
    } catch {
      /* ignore */
    }
    flash("Brand Kit cleared");
  };

  const applyDirection = useCallback((dir: NonNullable<typeof suggestion>) => {
    setPresetId(dir.presetId);
    setPaletteId(dir.paletteId);
    setSlideCount(dir.slideCount);
    setTone(dir.tone);
    setVoiceId(dir.voiceId);
  }, []);

  interface Overrides {
    presetId?: string;
    paletteId?: string;
    slideCount?: number;
    tone?: string;
    voiceId?: string;
  }

  const generate = useCallback(
    async (over: Overrides = {}) => {
      if (!topic.trim()) return;
      // Free tier: honour the daily quota.
      if (quotaState(plan, usage).blocked) {
        openUpgrade("unlimited");
        return;
      }
      const req = {
        topic,
        audience,
        handle,
        tone: over.tone ?? tone,
        voiceId: over.voiceId ?? voiceId,
        slideCount: over.slideCount ?? slideCount,
        presetId: over.presetId ?? presetId,
        research,
        // Pro reads the deeper keyless tier by default when no key is present.
        researchSource: research ? (isPro && !apiKey ? "web" : researchSource) : undefined,
        material: material.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      };
      const activePreset = getPreset(req.presetId);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setStage("working");
      setLog([{ kind: "phase", text: research ? "Researching…" : "Writing…" }]);
      // Only the embedded/hosted path is bot-shielded; BYOK skips the challenge.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!req.apiKey) {
        const token = await getTurnstileToken();
        if (token) headers["cf-turnstile-response"] = token;
      }
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers,
          signal: ac.signal,
          body: JSON.stringify(req),
        });
        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j?.error) msg = j.error;
          } catch {
            const t = await res.text().catch(() => "");
            if (t) msg = t;
          }
          throw new Error(msg);
        }
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
              setPresetId(req.presetId);
              if (over.paletteId !== undefined) setPaletteId(over.paletteId);
              setIndex(0);
              setStage("studio");
              bumpUsage();
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLog((l) => [...l, { kind: "error", text: err instanceof Error ? err.message : String(err) }]);
        setDeck(writeOfflineDeck({ topic, audience: audience || undefined, handle, preset: activePreset, slideCount: req.slideCount, voiceId: req.voiceId }));
        setPresetId(req.presetId);
        setIndex(0);
        setStage("studio");
        bumpUsage();
      }
    },
    [topic, audience, handle, tone, voiceId, slideCount, presetId, research, researchSource, material, apiKey, plan, usage, isPro, bumpUsage, getTurnstileToken],
  );

  const makeItGreat = useCallback(() => {
    if (!suggestion) return;
    applyDirection(suggestion);
    void generate({
      presetId: suggestion.presetId,
      paletteId: suggestion.paletteId,
      slideCount: suggestion.slideCount,
      tone: suggestion.tone,
      voiceId: suggestion.voiceId,
    });
  }, [suggestion, applyDirection, generate]);

  const applyInspiration = (i: Inspiration) => {
    // Register the derived palette so the renderer can resolve it by id.
    PALETTE_BY_ID.set(i.palette.id, i.palette);
    setPresetId(i.presetId);
    setPaletteId(i.palette.id);
    setSheet(null);
    flash("Look applied from your image");
  };

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

  /** Free decks carry a small attribution line in the caption; Pro drops it. */
  const captionText = (d: Deck) =>
    can(plan, "noAttribution") ? d.caption : `${d.caption}\n\nMade with Carousel Maker — no image models, just type & math.`;

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
          <header className="flex items-start justify-between gap-2 px-4 pt-5">
            <div>
              <h1 className="display text-[26px]">Carousel Maker</h1>
              <p className="mt-1 text-sm text-[var(--color-dim)]">A topic in, a finished carousel out.</p>
            </div>
            <div className="flex items-center gap-1">
              {!isPro && (
                <button className="badge badge-brand tap px-3" onClick={() => openUpgrade()}>
                  Go Pro
                </button>
              )}
              {isPro && <span className="badge badge-pro">PRO</span>}
              <ThemeToggle />
            </div>
          </header>

          <div className="px-4 pt-5">
            <textarea
              className="field"
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

            {/* Art Director live suggestion — the magic hint. */}
            {suggestion && !working && (
              <div className="card mt-3 p-3 rise">
                <div className="flex items-center gap-2">
                  <span className="badge badge-brand">Art Director</span>
                  <span className="text-[13px] text-[var(--color-dim)]">reads your topic</span>
                </div>
                <p className="mt-2 text-sm">
                  <strong>{getPreset(suggestion.presetId).name}</strong> · {getVoice(suggestion.voiceId).name} ·{" "}
                  {suggestion.slideCount} slides
                </p>
                <p className="prose-tight mt-1 text-[12px] text-[var(--color-dim)]">{suggestion.reasons[0]}</p>
                <button
                  className="btn btn-sm mt-2"
                  onClick={() => {
                    applyDirection(suggestion);
                    flash("Art Director's picks applied");
                  }}
                  disabled={working}
                >
                  Apply picks
                </button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <span className="eyebrow">Template</span>
              <div className="flex items-center gap-3">
                <button
                  className="text-sm text-[var(--color-brand-2)] underline underline-offset-4 tap"
                  onClick={() => (isPro ? setSheet("inspiration") : openUpgrade("inspiration"))}
                  disabled={working}
                >
                  Match a look
                </button>
                <button className="text-sm underline underline-offset-4 tap" onClick={() => setSheet("style")} disabled={working}>
                  All {PRESETS.length}
                </button>
              </div>
            </div>
          </div>

          <div className="rail mt-2 pb-1">
            {FEATURED.map((id) => {
              const p = getPreset(id);
              const on = p.id === presetId;
              return (
                <button key={id} onClick={() => setPresetId(id)} disabled={working} className="w-[104px] text-left" aria-pressed={on}>
                  <div className="overflow-hidden rounded-[var(--r-md)] border-2" style={{ borderColor: on ? "var(--color-brand)" : "transparent" }}>
                    <SlideCanvas deck={previewDeck} presetId={id} paletteId={on ? paletteId : undefined} index={1} scale={0.16} />
                  </div>
                  <div className="mt-1 truncate text-[12px]">{p.name}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 px-4 pt-4">
            <button className="btn justify-between" onClick={() => setSheet("voice")} disabled={working}>
              <span>Voice</span>
              <span className="truncate text-sm text-[var(--color-dim)]">{getVoice(voiceId).name.replace("The ", "")}</span>
            </button>
            <button className="btn justify-between" onClick={() => setSheet("options")} disabled={working}>
              <span>Options</span>
              <span className="truncate text-sm text-[var(--color-dim)]">
                {slideCount} · {research ? (apiKey ? "live" : researchSource === "web" ? "web" : "wiki") : "no research"}
              </span>
            </button>
          </div>

          {!isPro && (
            <p className="px-4 pt-3 text-[12px] text-[var(--color-dim)]">
              {quota.remaining} of {quota.limit} free carousels left this week.
            </p>
          )}

          {log.length > 0 && (
            <div className="scroll-thin mx-4 mt-4 max-h-52 overflow-y-auto rounded-[var(--r-md)] border border-[var(--color-edge)] bg-[var(--color-panel)] p-3 text-sm">
              {log.map((l, i) => (
                <div key={i} className="flex gap-2 py-0.5">
                  <span
                    className={
                      l.kind === "error" ? "text-[var(--color-danger)]"
                      : l.kind === "search" ? "text-[var(--color-brand-2)]"
                      : l.kind === "notice" ? "text-[var(--color-warn)]"
                      : "text-[var(--color-dim)]"
                    }
                  >
                    {l.kind === "search" ? "↗" : l.kind === "source" ? "•" : l.kind === "error" ? "!" : "·"}
                  </span>
                  {l.href ? (
                    <a className="truncate underline underline-offset-2" href={l.href} target="_blank" rel="noreferrer">{l.text}</a>
                  ) : (
                    <span className={l.kind === "error" ? "text-[var(--color-danger)]" : undefined}>{l.text}</span>
                  )}
                </div>
              ))}
              {working && <div className="dot-pulse py-1 text-[var(--color-dim)]">working…</div>}
            </div>
          )}
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
              <button className="btn btn-primary flex-1" onClick={makeItGreat} disabled={!topic.trim()}>
                <span aria-hidden>✦</span> Make it great
              </button>
              <button className="btn" onClick={() => void generate()} disabled={!topic.trim()} aria-label="Make with my picks">
                My picks
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

        <Sheet open={sheet === "style"} title="Template" onClose={() => setSheet(null)}>
          <StylePicker deck={previewDeck} presetId={presetId} paletteId={paletteId} onPreset={setPresetId} onPalette={setPaletteId} />
        </Sheet>

        <Sheet open={sheet === "voice"} title="Voice" onClose={() => setSheet(null)}>
          <VoicePicker voiceId={voiceId} onPick={(id) => { setVoiceId(id); setTone(getVoice(id).tone); }} />
        </Sheet>

        <Sheet open={sheet === "options"} title="Options" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-4 pt-1">
            <label className="block">
              <span className="eyebrow">Audience</span>
              <input className="field mt-1" placeholder="founders, students…" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </label>
            <label className="block">
              <span className="eyebrow">Your handle</span>
              <input className="field mt-1" placeholder="@yourhandle" value={handle} onChange={(e) => setHandle(e.target.value)} />
            </label>
            <label className="block">
              <span className="eyebrow">Tone</span>
              <select className="field mt-1" value={tone} onChange={(e) => setTone(e.target.value)}>
                {TONES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Slides</span>
                <span className="tnum text-sm">{slideCount}</span>
              </div>
              <input
                type="range" min={4} max={12} value={slideCount}
                onChange={(e) => { setSlideCount(Number(e.target.value)); setCountTouched(true); }}
                className="mt-2 w-full accent-[var(--color-brand)]"
              />
              <div className="text-[11px] text-[var(--color-dim)]">
                {preset.name} suits {preset.slideRange[0]}–{preset.slideRange[1]}
              </div>
            </div>
            <label className="tap flex items-center gap-3 text-sm">
              <input type="checkbox" checked={research} onChange={(e) => setResearch(e.target.checked)} className="size-5 accent-[var(--color-brand)]" />
              Research the topic first
            </label>
            {research && !apiKey && (
              <div>
                <span className="eyebrow">Research source</span>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["wikipedia", "web"] as const).map((src) => (
                    <button
                      key={src}
                      onClick={() => setResearchSource(src)}
                      className="btn btn-sm justify-center"
                      style={researchSource === src ? { borderColor: "var(--color-brand)", color: "var(--color-brand)" } : undefined}
                    >
                      {src === "wikipedia" ? "Wikipedia" : "Web"}
                    </button>
                  ))}
                </div>
                <p className="prose-tight mt-1 text-[11px] text-[var(--color-dim)]">
                  Keyless and free. <strong>Wikipedia</strong> uses article summaries; <strong>Web</strong> adds a deeper
                  extract plus a DuckDuckGo cross-check. With your own API key, the model searches the live web instead.
                </p>
              </div>
            )}
            <ApiKeyField value={apiKey} onChange={setApiKey} />
            <label className="block">
              <span className="eyebrow">Source material (optional)</span>
              <textarea
                className="field mt-1" rows={5}
                placeholder="Paste a transcript or your notes to write from."
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </label>

            {can(plan, "brandKit") ? (
              <div className="card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Brand Kit</span>
                  <span className="badge badge-pro">PRO</span>
                </div>
                <p className="prose-tight mt-0.5 text-[12px] text-[var(--color-dim)]">
                  Save your handle, voice and colours as defaults for every new deck.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="btn btn-sm" onClick={saveBrand}>Save current</button>
                  <button className="btn btn-sm" onClick={clearBrand}>Clear</button>
                </div>
              </div>
            ) : (
              <button className="card p-3 text-left" onClick={() => openUpgrade("brandKit")}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Brand Kit</span>
                  <span className="badge badge-pro">PRO</span>
                </div>
                <p className="prose-tight mt-0.5 text-[12px] text-[var(--color-dim)]">
                  Save your handle, voice and colours so every deck is on-brand. Unlock with Pro.
                </p>
              </button>
            )}
          </div>
        </Sheet>

        <InspirationSheet
          open={sheet === "inspiration"}
          onClose={() => setSheet(null)}
          isPro={isPro}
          onUpgrade={() => openUpgrade("inspiration")}
          onApply={applyInspiration}
        />

        <UpgradeSheet
          open={sheet === "upgrade"}
          onClose={() => setSheet(null)}
          context={upsell}
          plan={plan}
          onUnlock={() => { setPro(true); setSheet(null); flash("Pro unlocked on this device"); }}
          onDowngrade={() => { setPro(false); setSheet(null); }}
        />

        {toast && <Toast text={toast} />}
      </main>
    );
  }

  /* ------------------------------- studio ----------------------------- */

  if (!deck || !opts) return null;
  const slide = deck.slides[index];
  const missing = missingFields(deck, preset.needs).filter((f) => !["kicker", "note", "body"].includes(f));

  return (
    <main className="app">
      <header className="flex flex-none items-center gap-2 px-4 pt-4">
        <button className="btn btn-sm" onClick={() => setStage("compose")} aria-label="Back">←</button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{deck.topic}</div>
          <div className="truncate text-xs text-[var(--color-dim)]">{preset.name} · {index + 1} of {deck.slides.length}</div>
        </div>
        <button className="btn btn-sm" onClick={() => setSheet("style")}>Style</button>
      </header>

      {deck.engine && deck.engineKind !== "template" && (
        <p className="mx-4 mt-3 text-[11px] text-[var(--color-dim)]">
          Written by <strong className="text-[var(--color-text)]">{deck.engine}</strong>
          {deck.sources.length > 0 ? " · sources in the caption" : ""}
        </p>
      )}
      {deck.offline && (
        <p
          className="mx-4 mt-3 rounded-[var(--r-md)] px-3 py-2 text-xs"
          style={
            deck.enriched
              ? { background: "var(--color-brand-wash)", color: "var(--color-brand-2)" }
              : { background: "color-mix(in oklch, var(--color-warn) 14%, transparent)", color: "var(--color-warn)" }
          }
        >
          {deck.enriched
            ? `Drafted from public sources (${deck.researchSource === "web" ? "Web — Wikipedia + DuckDuckGo" : "Wikipedia"}) — free, no key. Facts are real; tighten the wording, then add your angle.`
            : "Draft skeleton — the layout is real, the words are placeholders. Tap Edit to replace them, or add an API key for AI-written copy."}
        </p>
      )}

      <div className="flex-1 overflow-y-auto py-4">
        <SlideDeck deck={deck} presetId={presetId} paletteId={paletteId} typeScale={typeScale} index={index} onIndex={setIndex} />

        <div className="mt-5 grid grid-cols-3 gap-2 px-4">
          <button className="btn" onClick={() => setSheet("edit")}>Edit</button>
          <button className="btn" onClick={() => setSheet("caption")}>Caption</button>
          <button className="btn" onClick={() => void runExport("one")} disabled={!!busy}>This slide</button>
        </div>
      </div>

      <div className="dock">
        <button className="btn btn-primary flex-1" disabled={!!busy} onClick={() => void runExport(canShare ? "share" : "zip")}>
          {busy ? `${busy.verb} ${busy.done}/${busy.total}…` : canShare ? "Share all slides" : "Download all"}
        </button>
        {canShare && (
          <button className="btn" disabled={!!busy} onClick={() => void runExport("zip")} aria-label="Download as zip">⤓</button>
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
            <button className="btn btn-sm" style={{ color: "var(--color-danger)" }} onClick={removeSlide} disabled={deck.slides.length <= 3}>Delete</button>
          </div>
        }
      >
        <SlideEditor slide={slide} presetId={presetId} onChange={updateSlide} />
      </Sheet>

      <Sheet open={sheet === "style"} title="Style" onClose={() => setSheet(null)}>
        {missing.length > 0 && (
          <div className="card mb-3 p-3">
            <p className="text-sm">
              <strong>{preset.name}</strong> shows {missing.join(", ")}, which this deck doesn&apos;t have yet — so the slides look thin.
            </p>
            <button className="btn btn-sm mt-2 w-full" onClick={() => { setSheet(null); void generate(); }}>
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
                await navigator.clipboard.writeText(`${captionText(deck)}\n\n${deck.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`);
                flash("Caption copied");
              }}
            >
              Copy caption
            </button>
            <button
              className="btn"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ version: 1, presetId, paletteId, typeScale, deck }, null, 2)], { type: "application/json" });
                downloadBlob(blob, `${slugify(deck.topic)}-project.json`);
                flash("Project saved");
              }}
            >
              Save project
            </button>
          </div>
        }
      >
        <textarea className="field text-sm" rows={9} value={deck.caption} onChange={(e) => setDeck({ ...deck, caption: e.target.value })} />
        <input
          className="field mt-2 text-sm"
          value={deck.hashtags.join(" ")}
          onChange={(e) => setDeck({ ...deck, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
        />
        {!isPro && (
          <p className="mt-2 text-[11px] text-[var(--color-dim)]">
            Free captions add a one-line credit. <button className="underline" onClick={() => openUpgrade("noAttribution")}>Remove it with Pro</button>.
          </p>
        )}
        {deck.sources.length > 0 && (
          <div className="mt-4">
            <div className="eyebrow mb-1">Sources</div>
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

function VoicePicker({ voiceId, onPick }: { voiceId: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      {VOICES.map((v) => {
        const on = v.id === voiceId;
        return (
          <button
            key={v.id}
            onClick={() => onPick(v.id)}
            className="card p-3 text-left"
            style={on ? { borderColor: "var(--color-brand)" } : undefined}
            aria-pressed={on}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{v.name}</span>
              {on && <span className="badge badge-brand">On</span>}
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--color-dim)]">{v.blurb}</p>
          </button>
        );
      })}
    </div>
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-panel-2)] px-4 py-2 text-sm shadow-lg"
      style={{ bottom: "calc(84px + var(--safe-b))", border: "1px solid var(--color-edge)", zIndex: "var(--z-toast)" }}
      role="status"
    >
      {text}
    </div>
  );
}
