import type { Palette } from "./types";

/* ------------------------------- fonts ------------------------------- */

export const FONT_KEYS = [
  "sans",
  "serif",
  "mono",
  "display",
  "hand",
  "condensed",
  "geo",
] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/** CSS custom properties injected by next/font in the root layout. */
export const FONT_VARS: Record<FontKey, string> = {
  sans: "--font-sans",
  serif: "--font-serif",
  mono: "--font-mono",
  display: "--font-display",
  hand: "--font-hand",
  condensed: "--font-condensed",
  geo: "--font-geo",
};

/** Used during SSR/tests and whenever a webfont fails to load. */
export const FONT_FALLBACKS: Record<FontKey, string> = {
  sans: `system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif`,
  serif: `Georgia, "Times New Roman", serif`,
  mono: `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
  display: `Impact, "Haettenschweiler", "Arial Black", sans-serif`,
  hand: `"Bradley Hand", "Segoe Script", cursive`,
  condensed: `"Arial Narrow", "Helvetica Neue Condensed", sans-serif`,
  geo: `"Avenir Next", Futura, system-ui, sans-serif`,
};

export type FontSet = Record<FontKey, string>;

/** Resolve the real family list from the DOM, falling back on the server. */
export function resolveFonts(): FontSet {
  const out = {} as FontSet;
  const root =
    typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
  for (const k of FONT_KEYS) {
    const v = root?.getPropertyValue(FONT_VARS[k]).trim();
    out[k] = v ? `${v}, ${FONT_FALLBACKS[k]}` : FONT_FALLBACKS[k];
  }
  return out;
}

/* ------------------------------ palettes ----------------------------- */

function pal(p: Omit<Palette, "dark"> & { dark?: boolean }): Palette {
  return { ...p, dark: p.dark ?? isDark(p.bg) };
}

function isDark(hex: string): boolean {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f.slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export const PALETTES: Palette[] = [
  pal({
    id: "midnight",
    name: "Midnight",
    bg: "#000000",
    fg: "#ffffff",
    muted: "#8e8e93",
    accent: "#2997ff",
    accent2: "#30d158",
    surface: "#1c1c1e",
    line: "#2c2c2e",
  }),
  pal({
    id: "paper",
    name: "Paper",
    bg: "#f6f3ec",
    fg: "#14110d",
    muted: "#7a736a",
    accent: "#c2410c",
    accent2: "#1d4ed8",
    surface: "#ffffff",
    line: "#ded7c9",
  }),
  pal({
    id: "ink",
    name: "Ink & Chalk",
    bg: "#ffffff",
    fg: "#000000",
    muted: "#6b7280",
    accent: "#e11d48",
    accent2: "#111827",
    surface: "#f4f4f5",
    line: "#111111",
  }),
  pal({
    id: "sunset",
    name: "Sunset",
    bg: "#1a0b2e",
    fg: "#fdf4ff",
    muted: "#a78bcf",
    accent: "#fb7185",
    accent2: "#fbbf24",
    surface: "#2c1250",
    line: "#41216e",
  }),
  pal({
    id: "forest",
    name: "Forest",
    bg: "#0f1f17",
    fg: "#eaf5ee",
    muted: "#88a795",
    accent: "#4ade80",
    accent2: "#fcd34d",
    surface: "#16301f",
    line: "#1f4230",
  }),
  pal({
    id: "electric",
    name: "Electric",
    bg: "#0a0a0a",
    fg: "#fafafa",
    muted: "#71717a",
    accent: "#ccff00",
    accent2: "#00e5ff",
    surface: "#171717",
    line: "#262626",
  }),
  pal({
    id: "clay",
    name: "Clay",
    bg: "#efe6dd",
    fg: "#2b2018",
    muted: "#8a7a6c",
    accent: "#b45309",
    accent2: "#0f766e",
    surface: "#fbf7f3",
    line: "#d9cabb",
  }),
  pal({
    id: "blueprint",
    name: "Blueprint",
    bg: "#0b2a4a",
    fg: "#e6f2ff",
    muted: "#7ba7ce",
    accent: "#67e8f9",
    accent2: "#fde68a",
    surface: "#0e3a63",
    line: "#1b4a76",
  }),
  pal({
    id: "mono",
    name: "Monochrome",
    bg: "#111111",
    fg: "#f5f5f5",
    muted: "#8a8a8a",
    accent: "#f5f5f5",
    accent2: "#b0b0b0",
    surface: "#1e1e1e",
    line: "#333333",
  }),
  pal({
    id: "candy",
    name: "Candy",
    bg: "#fff1f2",
    fg: "#4c0519",
    muted: "#9f6070",
    accent: "#e11d48",
    accent2: "#7c3aed",
    surface: "#ffffff",
    line: "#fecdd3",
  }),
  pal({
    id: "slate",
    name: "Slate",
    bg: "#f8fafc",
    fg: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    accent2: "#0d9488",
    surface: "#ffffff",
    line: "#e2e8f0",
  }),
  pal({
    id: "amber",
    name: "Amber Alert",
    bg: "#facc15",
    fg: "#0a0a0a",
    muted: "#6b5a00",
    accent: "#0a0a0a",
    accent2: "#dc2626",
    surface: "#fde68a",
    line: "#0a0a0a",
  }),
  pal({
    id: "terminal",
    name: "Terminal",
    bg: "#0d1117",
    fg: "#c9d1d9",
    muted: "#6e7681",
    accent: "#3fb950",
    accent2: "#d29922",
    surface: "#161b22",
    line: "#21262d",
  }),
  pal({
    id: "cream",
    name: "Cream Serif",
    bg: "#fbf7f0",
    fg: "#1b1b1b",
    muted: "#7d7468",
    accent: "#7f1d1d",
    accent2: "#1e3a8a",
    surface: "#ffffff",
    line: "#e6ddcf",
  }),
  pal({
    id: "chalk",
    name: "Chalkboard",
    bg: "#21302b",
    fg: "#f3f0e7",
    muted: "#9fb3a8",
    accent: "#ffd166",
    accent2: "#7fd1ae",
    surface: "#2b3d36",
    line: "#3d5148",
  }),
  pal({
    id: "lavender",
    name: "Lavender Note",
    bg: "#ece7fb",
    fg: "#241c3d",
    muted: "#6f649b",
    accent: "#7c3aed",
    accent2: "#ec4899",
    surface: "#ffffff",
    line: "#d9d0f5",
  }),
  pal({
    id: "notebook",
    name: "Notebook Ink",
    bg: "#fdfcf7",
    fg: "#1a2b4a",
    muted: "#5b6b85",
    accent: "#2563eb",
    accent2: "#dc2626",
    surface: "#eaf2ff",
    line: "#c8d8ec",
  }),
  pal({
    id: "parchment",
    name: "Parchment",
    bg: "#efe9dd",
    fg: "#1c1a15",
    muted: "#7c7365",
    accent: "#e2591f",
    accent2: "#2f6f5e",
    surface: "#f7f3ea",
    line: "#d3c9b6",
  }),
  pal({
    id: "highlighter",
    name: "Highlighter",
    bg: "#0b0b0c",
    fg: "#f7f7f5",
    muted: "#8b8b8f",
    accent: "#ffe14d",
    accent2: "#7dd3fc",
    surface: "#161618",
    line: "#2a2a2d",
  }),
];

export const PALETTE_BY_ID = new Map(PALETTES.map((p) => [p.id, p]));

export function getPalette(id: string | undefined, fallback: string): Palette {
  return PALETTE_BY_ID.get(id ?? "") ?? PALETTE_BY_ID.get(fallback) ?? PALETTES[0];
}

/* ------------------------------- colour ------------------------------ */

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const pb = parseInt(b.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const ch = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t);
  };
  const hex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hex(ch(16))}${hex(ch(8))}${hex(ch(0))}`;
}
