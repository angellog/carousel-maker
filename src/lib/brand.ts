/**
 * The brand, in one place. Every surface that names the product — page title,
 * header, caption credit, export readme, icons, share card — reads from here,
 * so a rename is a one-file change.
 *
 * The name is "The Carousel Maker": a maker in the old sense (the clockmaker,
 * the shoemaker) — someone who builds by hand. That is the product's promise:
 * every slide is typeset from type, vectors and math, never generated. The
 * definite article is what makes the phrase ownable; "carousel maker" alone is
 * a search term, not a name.
 */

export const BRAND = {
  name: "The Carousel Maker",
  /** Where the full name won't fit: home-screen label, tight UI. */
  short: "Carousel Maker",
  tagline: "Topic in. Carousel out.",
  /** The line that separates us from every AI carousel tool. */
  promise: "Every slide typeset, never generated.",
  description:
    "Turn a topic into a finished, ready-to-post Instagram carousel — researched, written and typeset by hand-built templates. No AI images, just type and math.",
  /** Brand colours as hex for surfaces that can't read CSS tokens (icons, OG). */
  colors: { ink: "#141c24", mint: "#34c79a", paper: "#f7f8f8" },
} as const;

/**
 * The public URL, when one is configured. Unset in local dev, in which case the
 * credit simply carries no link — we never print a domain we don't serve.
 */
export function siteUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/** "https://www.example.com" → "example.com" — how the link reads in a caption. */
export function displayHost(url: string): string {
  return new URL(url).host.replace(/^www\./, "");
}

/**
 * The free-tier caption credit. It is the product's main referral loop — every
 * free deck that gets posted shows it — so it names the craft ("typeset"), the
 * promise, and, when live, where to find us.
 */
export function captionCredit(url: string | undefined = siteUrl()): string {
  const base = `Typeset by ${BRAND.name} — no AI images, just type & math.`;
  return url ? `${base} ${displayHost(url)}` : base;
}
