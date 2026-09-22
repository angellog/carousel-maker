import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Makes "Add to Home Screen" install a proper app: its own name, icon and colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.short,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: BRAND.colors.ink,
    theme_color: BRAND.colors.ink,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
