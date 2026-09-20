import { describe, expect, it } from "vitest";
import { VOICES, VOICE_BY_ID, getVoice, voiceSystemPrompt, DEFAULT_VOICE } from "@/lib/content/voice";
import { buildSystemPrompt } from "@/lib/content/prompt";
import { writeOfflineDeck } from "@/lib/content/offline";
import { getPreset } from "@/lib/presets";

describe("voice catalogue", () => {
  it("ships five distinct, well-formed voices", () => {
    expect(VOICES).toHaveLength(5);
    const ids = new Set(VOICES.map((v) => v.id));
    expect(ids.size).toBe(5);
    for (const v of VOICES) {
      expect(v.name).toBeTruthy();
      expect(v.blurb).toBeTruthy();
      expect(v.tone).toBeTruthy();
      expect(v.guide.length).toBeGreaterThan(2);
      expect(v.caption).toBeTruthy();
    }
  });

  it("getVoice falls back to the default for unknown ids", () => {
    expect(getVoice("nope").id).toBe(DEFAULT_VOICE);
    expect(getVoice(undefined).id).toBe(DEFAULT_VOICE);
    expect(getVoice("contrarian").id).toBe("contrarian");
    expect(VOICE_BY_ID.get("hype")?.name).toBe("The Hype");
  });

  it("voiceSystemPrompt names the voice and carries its rules", () => {
    const p = voiceSystemPrompt("analyst");
    expect(p).toContain("The Analyst");
    expect(p.toLowerCase()).toContain("mechanism");
  });
});

describe("voice in the system prompt", () => {
  it("splices the chosen voice into the writer prompt", () => {
    const preset = getPreset("keynote");
    const withHype = buildSystemPrompt(preset, {
      topic: "x", slideCount: 6, presetId: "keynote", research: false, voiceId: "hype",
    });
    expect(withHype).toContain("Voice: The Hype");
    // The non-negotiable rules still stand alongside the voice.
    expect(withHype).toContain("One idea per slide");
  });
});

describe("voice in the keyless draft", () => {
  it("shifts the cover kicker and CTA by voice, deterministically", () => {
    const preset = getPreset("numberlist");
    const base = { topic: "morning routines", preset, slideCount: 6 };
    const straight = writeOfflineDeck({ ...base, voiceId: "straight" });
    const contrarian = writeOfflineDeck({ ...base, voiceId: "contrarian" });

    expect(straight.slides[0].kicker).toBe("Read this first");
    expect(contrarian.slides[0].kicker).toBe("Unpopular take");
    // CTA differs by voice.
    const ctaStraight = straight.slides.at(-1)!.title;
    const ctaContrarian = contrarian.slides.at(-1)!.title;
    expect(ctaStraight).not.toBe(ctaContrarian);
    // Deterministic: same input, same output.
    expect(writeOfflineDeck({ ...base, voiceId: "contrarian" }).slides.at(-1)!.title).toBe(ctaContrarian);
  });

  it("keeps honesty regardless of voice (no fabricated stat)", () => {
    const preset = getPreset("statlist");
    const deck = writeOfflineDeck({ topic: "sleep", preset, slideCount: 6, voiceId: "hype" });
    for (const s of deck.slides) {
      if (s.stat) {
        expect(/\d/.test(s.stat.value)).toBe(false);
        expect(s.stat.label.toLowerCase()).toContain("source");
      }
    }
  });
});
