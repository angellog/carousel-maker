"use client";

import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const KEY = "cm-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* private mode — the in-memory attribute still applies for this session */
  }
}

const ORDER: Theme[] = ["system", "light", "dark"];
const ICON: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };
const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

/** A single cycling button: System → Light → Dark. No flash (see layout boot script). */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
  };

  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={cycle}
      aria-label={`${LABEL[theme]} — tap to change`}
      title={LABEL[theme]}
    >
      <span aria-hidden style={{ fontSize: 15 }}>{ICON[theme]}</span>
    </button>
  );
}
