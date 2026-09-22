import { BRAND } from "@/lib/brand";

/** The mark as a standalone SVG string, for raster surfaces (apple icon, share card). */
export function markSvg(color: string = BRAND.colors.mint): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="${color}"><circle cx="32" cy="9" r="2.6"/><path d="M12 26 L32 12 L52 26 Z"/><path d="M12 26 a6.67 6.67 0 0 0 13.33 0 a6.67 6.67 0 0 0 13.34 0 a6.67 6.67 0 0 0 13.33 0 Z"/><rect x="14" y="37" width="9" height="15" rx="2" opacity="0.4"/><rect x="41" y="37" width="9" height="15" rx="2" opacity="0.4"/><rect x="25.5" y="34" width="13" height="21" rx="2.5"/></g></svg>`;
}

export const markDataUri = (color?: string) =>
  `data:image/svg+xml;base64,${Buffer.from(markSvg(color)).toString("base64")}`;

/**
 * Loads a Google font as raw bytes for next/og. Returns undefined on any
 * failure (offline build, blocked network) so the image still renders in the
 * default face rather than breaking the build.
 */
export async function loadGoogleFont(family: string, weight = 400): Promise<ArrayBuffer | undefined> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`)
    ).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!src) return undefined;
    const res = await fetch(src);
    return res.ok ? await res.arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}
