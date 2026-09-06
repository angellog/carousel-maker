import { describe, expect, it } from "vitest";
import { ICON_NAMES, ICON_PATHS, hasIcon, iconFor, iconPath } from "@/lib/render/icons";
import { PALETTES, getPalette, mix, withAlpha } from "@/lib/theme";

describe("icon library", () => {
  it("exposes a usable set of icons", () => {
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(24);
    expect(hasIcon("bulb")).toBe(true);
    expect(hasIcon("definitely-not-an-icon")).toBe(false);
  });

  it("emits only valid path commands and finite numbers", () => {
    for (const name of ICON_NAMES) {
      const d = iconPath(name, 10, 20, 50);
      expect(d, name).not.toMatch(/NaN|Infinity|undefined/);
      expect(d, name).toMatch(/^M/);
      for (const n of d.match(/-?\d+(\.\d+)?/g) ?? []) {
        expect(Number.isFinite(parseFloat(n)), `${name}: ${n}`).toBe(true);
      }
    }
  });

  it("translates and scales absolute coordinates", () => {
    // "check" is a pure absolute polyline: M 20 52 L 42 74 L 82 28
    const d = iconPath("check", 0, 0, 100);
    expect(d).toBe(ICON_PATHS.check);
    const moved = iconPath("check", 100, 200, 100);
    expect(moved).toBe("M 120 252 L 142 274 L 182 228");
    const halved = iconPath("check", 0, 0, 50);
    expect(halved).toBe("M 10 26 L 21 37 L 41 14");
  });

  it("scales arc radii and deltas but preserves the flag parameters", () => {
    // clock starts: M 50 50 m -36 0 a 36 36 0 1 0 72 0 ...
    const d = iconPath("clock", 0, 0, 50);
    expect(d.startsWith("M 25 25 m -18 0 a 18 18 0 1 0 36 0")).toBe(true);
  });

  it("returns an empty string for an unknown icon rather than throwing", () => {
    expect(iconPath("nope", 0, 0, 10)).toBe("");
  });
});

describe("iconFor", () => {
  it("maps meaningful words to the matching icon", () => {
    expect(iconFor("keep your data secure")).toBe("shield");
    expect(iconFor("encrypt the password")).toBe("lock");
    expect(iconFor("revenue growth chart")).toBe("chart");
    expect(iconFor("ship it faster")).toBe("rocket");
  });

  it("is deterministic and always returns a real icon", () => {
    for (const s of ["zzz", "qqqq", "", "1234", "a topic with no keyword"]) {
      const a = iconFor(s);
      expect(iconFor(s)).toBe(a);
      expect(hasIcon(a), `${s} → ${a}`).toBe(true);
    }
  });
});

describe("palettes", () => {
  it("are uniquely identified and fully specified", () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const p of PALETTES) {
      for (const k of ["bg", "fg", "muted", "accent", "accent2", "surface", "line"] as const) {
        expect(p[k], `${p.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("classifies light and dark grounds correctly", () => {
    expect(getPalette("midnight", "paper").dark).toBe(true);
    expect(getPalette("paper", "midnight").dark).toBe(false);
  });

  it("falls back through the chain for unknown ids", () => {
    expect(getPalette("nope", "paper").id).toBe("paper");
    expect(getPalette(undefined, "nope").id).toBe(PALETTES[0].id);
  });

  it("mixes and alpha-blends colours predictably", () => {
    expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mix("#ff0000", "#00ff00", 0)).toBe("#ff0000");
    expect(withAlpha("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    expect(withAlpha("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });
});
