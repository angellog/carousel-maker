import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { PRESETS } from "@/lib/presets";
import { loadGoogleFont, markDataUri } from "./brand-assets";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: the name set like a maker's plate, and a fanned deck of slides. */
export default async function OpengraphImage() {
  const [display, serif] = await Promise.all([
    loadGoogleFont("Archivo Black"),
    loadGoogleFont("Playfair Display:ital", 400).then((f) => f ?? loadGoogleFont("Playfair Display")),
  ]);
  const fonts = [
    display && { name: "Display", data: display, weight: 400 as const, style: "normal" as const },
    serif && { name: "Serif", data: serif, weight: 400 as const, style: "italic" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400; style: "normal" | "italic" }[];

  const { ink, mint, paper } = BRAND.colors;
  const card = (rotate: number, x: number, y: number, fill: string, label: string, color: string) => (
    <div
      style={{
        position: "absolute", left: x, top: y, width: 250, height: 312, borderRadius: 22, background: fill,
        transform: `rotate(${rotate}deg)`, display: "flex", flexDirection: "column", justifyContent: "flex-end",
        padding: 26, boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ width: 120, height: 10, borderRadius: 5, background: color, opacity: 0.35, marginBottom: 14 }} />
      <div style={{ fontFamily: "Display", fontSize: 34, lineHeight: 1.05, color }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: ink, padding: 72, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 620 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markDataUri(mint)} width={88} height={88} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Serif", fontStyle: "italic", fontSize: 44, color: "#9fb0bd" }}>The</div>
            <div style={{ fontFamily: "Display", fontSize: 92, lineHeight: 0.98, color: paper }}>Carousel Maker</div>
            <div style={{ fontFamily: "Display", fontSize: 36, color: mint, marginTop: 28 }}>{BRAND.tagline}</div>
          </div>
          <div style={{ fontFamily: "Serif", fontStyle: "italic", fontSize: 28, color: "#9fb0bd" }}>
            {`${PRESETS.length} hand-built templates · no AI images`}
          </div>
        </div>
        {card(-9, 700, 150, "#243140", "Myth vs fact", paper)}
        {card(7, 900, 170, paper, "5 rules that stick", ink)}
        {card(-1, 800, 120, mint, "Topic in. Carousel out.", ink)}
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
