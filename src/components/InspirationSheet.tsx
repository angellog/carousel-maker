"use client";

import { useRef, useState } from "react";
import Sheet from "./Sheet";
import { analyzeImageFile, type Inspiration } from "@/lib/inspiration";
import { getPreset } from "@/lib/presets";

interface Props {
  open: boolean;
  onClose: () => void;
  isPro: boolean;
  onUpgrade: () => void;
  onApply: (i: Inspiration) => void;
}

type State =
  | { k: "idle" }
  | { k: "analyzing" }
  | { k: "done"; i: Inspiration; name: string }
  | { k: "error"; msg: string };

export default function InspirationSheet({ open, onClose, isPro, onUpgrade, onApply }: Props) {
  const [state, setState] = useState<State>({ k: "idle" });
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = () => fileRef.current?.click();

  const analyze = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ k: "error", msg: "That file isn't an image. Pick a screenshot (PNG or JPG) and try again." });
      return;
    }
    setState({ k: "analyzing" });
    try {
      const i = await analyzeImageFile(file);
      setState({ k: "done", i, name: getPreset(i.presetId).name });
    } catch (err) {
      setState({
        k: "error",
        msg: err instanceof Error ? err.message : "Couldn't read that image. Try a different screenshot.",
      });
    }
  };

  return (
    <Sheet
      open={open}
      title="Bring your inspiration"
      onClose={onClose}
      footer={
        isPro && state.k === "done" ? (
          <button className="btn btn-primary w-full" onClick={() => onApply(state.i)}>
            Use this look
          </button>
        ) : undefined
      }
    >
      {!isPro ? (
        <div className="flex flex-col gap-3 pb-1">
          <p className="text-sm text-[var(--color-dim)]">
            Drop a screenshot of any carousel or post you love. Carousel Maker reads its palette and
            layout with pure canvas math — no image models — and matches the closest template, tinted
            to your image.
          </p>
          <div className="card flex items-center gap-3 p-3">
            <span className="badge badge-pro">PRO</span>
            <span className="text-sm">Available on Pro.</span>
          </div>
          <button className="btn btn-primary w-full" onClick={onUpgrade}>
            Unlock Inspiration
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void analyze(f);
              e.target.value = "";
            }}
          />

          {state.k !== "done" && (
            <button
              className="card flex min-h-[128px] flex-col items-center justify-center gap-2 p-6 text-center"
              onClick={pick}
              style={{ borderStyle: "dashed" }}
            >
              {state.k === "analyzing" ? (
                <span className="dot-pulse text-sm text-[var(--color-dim)]">Reading the colours…</span>
              ) : (
                <>
                  <span className="text-2xl" aria-hidden>⇪</span>
                  <span className="text-sm font-medium">Upload a screenshot</span>
                  <span className="text-[12px] text-[var(--color-dim)]">PNG or JPG · analysed on your device</span>
                </>
              )}
            </button>
          )}

          {state.k === "error" && (
            <p className="rounded-[var(--r-md)] px-3 py-2.5 text-sm" style={{ background: "color-mix(in oklch, var(--color-danger) 14%, transparent)", color: "var(--color-danger)" }}>
              {state.msg}
            </p>
          )}

          {state.k === "done" && (
            <div className="flex flex-col gap-3">
              <div className="card overflow-hidden">
                <div className="flex h-16">
                  {[state.i.palette.bg, state.i.palette.surface, state.i.palette.accent, state.i.palette.accent2, state.i.palette.fg].map(
                    (c, idx) => (
                      <span key={idx} style={{ background: c, flex: 1 }} />
                    ),
                  )}
                </div>
                <div className="p-3">
                  <div className="text-sm">
                    Closest template: <strong>{state.name}</strong>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--color-dim)]">{state.i.note}</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm self-start" onClick={pick}>
                Try another image
              </button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
