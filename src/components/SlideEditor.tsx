"use client";

import { getPreset } from "@/lib/presets";
import { MAX_TITLE_WORDS, wordCount } from "@/lib/content/schema";
import type { Slide, SlideField } from "@/lib/types";

interface Props {
  slide: Slide;
  presetId: string;
  onChange: (next: Slide) => void;
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between">
      <span className="text-xs font-medium uppercase tracking-widest text-[var(--color-dim)]">{children}</span>
      {hint ? <span className="text-[11px] text-[var(--color-dim)]">{hint}</span> : null}
    </div>
  );
}

const linesToArray = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export default function SlideEditor({ slide, presetId, onChange }: Props) {
  const preset = getPreset(presetId);
  const needs = new Set<SlideField>(preset.needs);
  const set = (patch: Partial<Slide>) => onChange({ ...slide, ...patch });
  const titleWords = wordCount(slide.title);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <select
          className="field w-auto"
          value={slide.role}
          onChange={(e) => set({ role: e.target.value as Slide["role"] })}
        >
          <option value="cover">Cover</option>
          <option value="body">Body</option>
          <option value="cta">CTA</option>
        </select>
        <span className="text-xs text-[var(--color-dim)]">
          Markup: <code>**accent**</code> <code>==highlight==</code> <code>__underline__</code>
        </span>
      </div>

      {needs.has("kicker") && (
        <div>
          <Label>Kicker</Label>
          <input
            className="field"
            value={slide.kicker ?? ""}
            placeholder="Small label above the headline"
            onChange={(e) => set({ kicker: e.target.value || undefined })}
          />
        </div>
      )}

      <div>
        <Label hint={`${titleWords}/${MAX_TITLE_WORDS} words`}>Headline</Label>
        <textarea
          className="field"
          rows={2}
          value={slide.title}
          style={titleWords > MAX_TITLE_WORDS ? { borderColor: "#f87171" } : undefined}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>

      {needs.has("body") && (
        <div>
          <Label>Body</Label>
          <textarea
            className="field"
            rows={3}
            value={slide.body ?? ""}
            placeholder="One or two short sentences"
            onChange={(e) => set({ body: e.target.value || undefined })}
          />
        </div>
      )}

      {needs.has("bullets") && (
        <div>
          <Label hint="one per line">Bullets</Label>
          <textarea
            className="field"
            rows={4}
            value={(slide.bullets ?? []).join("\n")}
            onChange={(e) => {
              const v = linesToArray(e.target.value);
              set({ bullets: v.length ? v : undefined });
            }}
          />
        </div>
      )}

      {needs.has("stat") && (
        <div>
          <Label>Stat</Label>
          <div className="grid grid-cols-3 gap-2">
            <input
              className="field"
              placeholder="71%"
              value={slide.stat?.value ?? ""}
              onChange={(e) =>
                set({
                  stat: e.target.value
                    ? { value: e.target.value, label: slide.stat?.label ?? "", delta: slide.stat?.delta }
                    : undefined,
                })
              }
            />
            <input
              className="field col-span-2"
              placeholder="What the number means"
              value={slide.stat?.label ?? ""}
              onChange={(e) =>
                set({ stat: { value: slide.stat?.value ?? "", label: e.target.value, delta: slide.stat?.delta } })
              }
            />
          </div>
          <input
            className="field mt-2"
            placeholder="Delta, e.g. +38% (optional)"
            value={slide.stat?.delta ?? ""}
            onChange={(e) =>
              set({
                stat: {
                  value: slide.stat?.value ?? "",
                  label: slide.stat?.label ?? "",
                  delta: e.target.value || undefined,
                },
              })
            }
          />
        </div>
      )}

      {needs.has("quote") && (
        <div>
          <Label>Quote</Label>
          <textarea
            className="field"
            rows={3}
            placeholder="The line worth screenshotting"
            value={slide.quote?.text ?? ""}
            onChange={(e) =>
              set({
                quote: e.target.value
                  ? { text: e.target.value, author: slide.quote?.author ?? "", role: slide.quote?.role }
                  : undefined,
              })
            }
          />
          <input
            className="field mt-2"
            placeholder="Attribution"
            value={slide.quote?.author ?? ""}
            onChange={(e) => set({ quote: { text: slide.quote?.text ?? "", author: e.target.value } })}
          />
        </div>
      )}

      {needs.has("items") && (
        <div>
          <Label hint="label | value, one per line">Rows</Label>
          <textarea
            className="field"
            rows={6}
            value={(slide.items ?? []).map((i) => `${i.label} | ${i.value}`).join("\n")}
            onChange={(e) => {
              const v = linesToArray(e.target.value).map((l) => {
                const [label, ...rest] = l.split("|");
                return { label: label.trim(), value: rest.join("|").trim() };
              });
              set({ items: v.length ? v : undefined });
            }}
          />
        </div>
      )}

      {needs.has("steps") && (
        <div>
          <Label hint="label | text, one per line">Steps</Label>
          <textarea
            className="field"
            rows={5}
            value={(slide.steps ?? []).map((s) => `${s.label} | ${s.text}`).join("\n")}
            onChange={(e) => {
              const v = linesToArray(e.target.value).map((l) => {
                const [label, ...rest] = l.split("|");
                return { label: label.trim(), text: rest.join("|").trim() };
              });
              set({ steps: v.length ? v : undefined });
            }}
          />
        </div>
      )}

      {needs.has("compare") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Left</Label>
            <input
              className="field mb-2"
              placeholder="MOST PEOPLE"
              value={slide.compare?.leftLabel ?? ""}
              onChange={(e) =>
                set({
                  compare: {
                    leftLabel: e.target.value,
                    leftItems: slide.compare?.leftItems ?? [],
                    rightLabel: slide.compare?.rightLabel ?? "",
                    rightItems: slide.compare?.rightItems ?? [],
                  },
                })
              }
            />
            <textarea
              className="field"
              rows={4}
              value={(slide.compare?.leftItems ?? []).join("\n")}
              onChange={(e) =>
                set({
                  compare: {
                    leftLabel: slide.compare?.leftLabel ?? "",
                    leftItems: linesToArray(e.target.value),
                    rightLabel: slide.compare?.rightLabel ?? "",
                    rightItems: slide.compare?.rightItems ?? [],
                  },
                })
              }
            />
          </div>
          <div>
            <Label>Right</Label>
            <input
              className="field mb-2"
              placeholder="DO THIS INSTEAD"
              value={slide.compare?.rightLabel ?? ""}
              onChange={(e) =>
                set({
                  compare: {
                    leftLabel: slide.compare?.leftLabel ?? "",
                    leftItems: slide.compare?.leftItems ?? [],
                    rightLabel: e.target.value,
                    rightItems: slide.compare?.rightItems ?? [],
                  },
                })
              }
            />
            <textarea
              className="field"
              rows={4}
              value={(slide.compare?.rightItems ?? []).join("\n")}
              onChange={(e) =>
                set({
                  compare: {
                    leftLabel: slide.compare?.leftLabel ?? "",
                    leftItems: slide.compare?.leftItems ?? [],
                    rightLabel: slide.compare?.rightLabel ?? "",
                    rightItems: linesToArray(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {needs.has("chat") && (
        <div>
          <Label hint="prefix each line with them: or me:">Conversation</Label>
          <textarea
            className="field"
            rows={5}
            value={(slide.chat ?? []).map((t) => `${t.from}: ${t.text}`).join("\n")}
            onChange={(e) => {
              const v = linesToArray(e.target.value).map((l) => {
                const m = /^(them|me)\s*:\s*(.*)$/i.exec(l);
                return m
                  ? { from: m[1].toLowerCase() as "them" | "me", text: m[2] }
                  : { from: "me" as const, text: l };
              });
              set({ chat: v.length ? v : undefined });
            }}
          />
        </div>
      )}

      {needs.has("code") && (
        <div>
          <Label hint="one line per line">Prompt / code</Label>
          <textarea
            className="field font-mono text-sm"
            rows={6}
            value={(slide.code?.lines ?? []).join("\n")}
            onChange={(e) => {
              const lines = e.target.value.split("\n");
              set({
                code: e.target.value.trim()
                  ? { lang: slide.code?.lang ?? "prompt", lines }
                  : undefined,
              });
            }}
          />
        </div>
      )}

      {needs.has("note") && (
        <div>
          <Label>Small print</Label>
          <input
            className="field"
            value={slide.note ?? ""}
            placeholder="One-line takeaway or footnote"
            onChange={(e) => set({ note: e.target.value || undefined })}
          />
        </div>
      )}
    </div>
  );
}
