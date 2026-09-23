import JSZip from "jszip";
import { getPreset } from "../presets";
import { fontsReady, paintSlide, SLIDE_H, SLIDE_W, type RenderOptions } from "../renderDeck";
import { plain } from "../render/text";
import type { Deck } from "../types";

export const EXPORT_SCALE = 2; // 2160 × 2700 — well above Instagram's 1080 requirement

function offscreen(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = SLIDE_W * EXPORT_SCALE;
  c.height = SLIDE_H * EXPORT_SCALE;
  return c;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png"): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), type, 1);
  });
}

export async function renderSlideBlob(o: RenderOptions, index: number): Promise<Blob> {
  await fontsReady();
  const canvas = offscreen();
  paintSlide(canvas, o, index, EXPORT_SCALE);
  return canvasToBlob(canvas);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(s: string): string {
  return (
    plain(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "carousel"
  );
}

/**
 * The clean, copy-paste caption a user pastes under their post: the caption
 * text plus hashtags, and nothing else. Research sources are deliberately kept
 * out — they go in a separate `sources.txt` (see `sourcesFile`) so they never
 * leak into the caption or the share-sheet text.
 */
export function captionFile(deck: Deck): string {
  const lines = [deck.caption.trim()];
  if (deck.hashtags.length) lines.push("", deck.hashtags.join(" "));
  return lines.join("\n").trim();
}

/** Research provenance for the zip, kept separate from the caption. Null when none. */
export function sourcesFile(deck: Deck): string | null {
  if (!deck.sources.length) return null;
  const lines = [
    `Sources for "${plain(deck.topic)}"`,
    "(Reference only — do not paste these into your caption.)",
    "",
  ];
  for (const s of deck.sources) lines.push(`- ${s.title} — ${s.url}`);
  return lines.join("\n");
}

export interface ZipProgress {
  done: number;
  total: number;
}

/** Full deliverable: numbered PNGs, the caption, and a re-openable project file. */
export async function exportZip(
  o: RenderOptions,
  onProgress?: (p: ZipProgress) => void,
): Promise<Blob> {
  await fontsReady();
  const zip = new JSZip();
  const total = o.deck.slides.length;
  const canvas = offscreen();
  for (let i = 0; i < total; i++) {
    paintSlide(canvas, o, i, EXPORT_SCALE);
    const blob = await canvasToBlob(canvas);
    zip.file(`${String(i + 1).padStart(2, "0")}.png`, blob);
    onProgress?.({ done: i + 1, total });
    // Yield so the progress bar can actually paint between slides.
    await new Promise((r) => setTimeout(r, 0));
  }
  zip.file("caption.txt", captionFile(o.deck));
  const sources = sourcesFile(o.deck);
  if (sources) zip.file("sources.txt", sources);
  zip.file(
    "project.json",
    JSON.stringify(
      { version: 1, presetId: o.presetId, paletteId: o.paletteId, typeScale: o.typeScale, deck: o.deck },
      null,
      2,
    ),
  );
  zip.file(
    "README.txt",
    [
      `Carousel: ${plain(o.deck.topic)}`,
      `Template: ${getPreset(o.presetId).name}`,
      `Slides: ${total} · ${SLIDE_W * EXPORT_SCALE}×${SLIDE_H * EXPORT_SCALE} PNG (4:5)`,
      "",
      "Post the PNGs in numeric order. caption.txt is the ready-to-paste caption",
      "(caption + hashtags only). project.json can be re-opened in The Carousel Maker.",
      sources ? "sources.txt lists the research sources — reference only, not for the caption." : "",
      o.deck.offline
        ? "\nNote: this is a draft skeleton from the offline writer — replace the placeholder\nnumbers and examples with your own before posting."
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return zip.generateAsync({ type: "blob" });
}

export async function downloadAll(
  o: RenderOptions,
  onProgress?: (p: ZipProgress) => void,
): Promise<void> {
  const blob = await exportZip(o, onProgress);
  downloadBlob(blob, `${slugify(o.deck.topic)}-carousel.zip`);
}

/** True when the browser can share image files (iOS/Android Safari & Chrome). */
export function canShareFiles(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) return false;
  try {
    const probe = new File([new Blob([new Uint8Array([0])])], "probe.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/**
 * Hand the whole carousel to the OS share sheet — on a phone this drops the
 * slides straight into Instagram, which is the entire point of the app.
 * Returns "unsupported" when the browser cannot share files, so the caller can
 * fall back to a ZIP download.
 */
export async function shareCarousel(
  o: RenderOptions,
  onProgress?: (p: ZipProgress) => void,
): Promise<"shared" | "cancelled" | "unsupported"> {
  if (!canShareFiles()) return "unsupported";
  await fontsReady();
  const total = o.deck.slides.length;
  const canvas = offscreen();
  const files: File[] = [];
  for (let i = 0; i < total; i++) {
    paintSlide(canvas, o, i, EXPORT_SCALE);
    const blob = await canvasToBlob(canvas);
    files.push(new File([blob], `${String(i + 1).padStart(2, "0")}.png`, { type: "image/png" }));
    onProgress?.({ done: i + 1, total });
    await new Promise((r) => setTimeout(r, 0));
  }
  if (!navigator.canShare({ files })) return "unsupported";
  try {
    await navigator.share({ files, text: captionFile(o.deck) });
    return "shared";
  } catch (err) {
    // The user dismissing the share sheet is not an error worth surfacing.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    throw err;
  }
}

/**
 * Slides as Instagram-ready JPEGs: 1080×1350 (Instagram downscales anything
 * wider than 1440, and rejects PNG for API posts).
 */
export async function renderJpegs(
  o: RenderOptions,
  onProgress?: (p: ZipProgress) => void,
): Promise<Blob[]> {
  await fontsReady();
  const canvas = document.createElement("canvas");
  canvas.width = SLIDE_W;
  canvas.height = SLIDE_H;
  const out: Blob[] = [];
  for (let i = 0; i < o.deck.slides.length; i++) {
    paintSlide(canvas, o, i, 1);
    out.push(await canvasToBlob(canvas, "image/jpeg"));
    onProgress?.({ done: i + 1, total: o.deck.slides.length });
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export async function downloadSlide(o: RenderOptions, index: number): Promise<void> {
  const blob = await renderSlideBlob(o, index);
  downloadBlob(blob, `${slugify(o.deck.topic)}-${String(index + 1).padStart(2, "0")}.png`);
}
