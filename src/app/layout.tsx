import type { Metadata, Viewport } from "next";
import {
  Archivo_Black,
  Caveat,
  Inter,
  JetBrains_Mono,
  Oswald,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const display = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const hand = Caveat({ subsets: ["latin"], variable: "--font-hand", display: "swap" });
const condensed = Oswald({ subsets: ["latin"], variable: "--font-condensed", display: "swap" });
const geo = Space_Grotesk({ subsets: ["latin"], variable: "--font-geo", display: "swap" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app is a fixed single column; zooming is still allowed for a11y.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0b0d10",
};

export const metadata: Metadata = {
  title: "Carousel Maker",
  description:
    "Turn a topic into a finished, downloadable Instagram carousel. 45 vector templates, no image generation.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Carousel" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${display.variable} ${hand.variable} ${condensed.variable} ${geo.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
