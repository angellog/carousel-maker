import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { markDataUri } from "./brand-assets";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.colors.ink }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markDataUri()} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
