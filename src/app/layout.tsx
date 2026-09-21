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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1417" },
  ],
};

export const metadata: Metadata = {
  title: "Carousel Maker — topic in, carousel out",
  description:
    "Turn a topic into a finished, ready-to-post Instagram carousel. 24 templates, an Art Director, and honest research — with zero image-generation models.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Carousel" },
};

/**
 * Applies the saved theme before first paint so there's no light/dark flash.
 * Falls back silently to the OS preference when storage is unavailable.
 */
const THEME_BOOT = `try{var t=localStorage.getItem('cm-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable} ${display.variable} ${hand.variable} ${condensed.variable} ${geo.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
