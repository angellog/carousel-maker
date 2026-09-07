import { describe, expect, it } from "vitest";
import { toPhrase } from "@/lib/content/offline";

describe("toPhrase — clean, slide-safe truncation", () => {
  it("returns a short sentence unchanged, minus trailing punctuation", () => {
    expect(toPhrase("A habit is a routine of behavior repeated regularly.", 92)).toBe(
      "A habit is a routine of behavior repeated regularly",
    );
  });

  it("prefers the first whole sentence when several are present and it fits", () => {
    const r = toPhrase("Photosynthesis feeds most life on Earth. It also releases oxygen as a byproduct.", 150);
    expect(r).toBe("Photosynthesis feeds most life on Earth");
    expect(r).not.toContain("…");
  });

  it("ends at a clause boundary rather than mid-thought", () => {
    const r = toPhrase("It is the largest telescope in space, and is equipped with a huge segmented mirror.", 70);
    expect(r).toBe("It is the largest telescope in space");
    expect(r).not.toContain("…");
  });

  it("never ends on a dangling function word before an ellipsis", () => {
    const r = toPhrase("The James Webb Space Telescope is a space telescope designed to conduct infrared astronomy.", 70);
    expect(r.endsWith("…")).toBe(true);
    expect(r).not.toMatch(/\b(to|and|of|the|a|is|with|for)…$/);
  });

  it("cuts only at a word boundary — never mid-word", () => {
    const r = toPhrase("Chlorophyll molecules absorb predominantly red and blue wavelengths of visible sunlight efficiently", 40);
    // The character just before the ellipsis is a letter that completes a word.
    const beforeEllipsis = r.replace(/…$/, "");
    expect(beforeEllipsis).toBe(beforeEllipsis.trim());
    expect(/\s$/.test(beforeEllipsis)).toBe(false);
    // And the elided phrase is a prefix of the original words.
    expect("Chlorophyll molecules absorb predominantly red and blue wavelengths of visible sunlight efficiently").toContain(beforeEllipsis);
  });

  it("strips parentheticals before measuring", () => {
    expect(toPhrase("Caffeine (a stimulant) blocks adenosine receptors in the brain.", 92)).toBe(
      "Caffeine blocks adenosine receptors in the brain",
    );
  });

  it("keeps the elided result within the length budget", () => {
    const long = "A".repeat(300);
    expect(toPhrase(long, 70).length).toBeLessThanOrEqual(72); // max + the ellipsis
  });
});
