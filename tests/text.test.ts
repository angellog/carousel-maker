import { describe, expect, it } from "vitest";
import {
  fitText,
  makeCachedMeasurer,
  metricMeasurer,
  parseRich,
  plain,
  wrapRich,
  wrapTokens,
  type FontSpec,
} from "@/lib/render/text";

const marks = {
  accent: { color: "#f00", weight: 800 },
  highlight: { highlight: "#ff0" },
  underline: { underline: "#00f" },
  strike: { strike: "#888" },
};

describe("inline markup", () => {
  it("splits words and applies the matching style", () => {
    const t = parseRich("plain **bold word** tail", marks);
    expect(t.map((x) => x.text)).toEqual(["plain", "bold", "word", "tail"]);
    expect(t[0].style).toBeUndefined();
    expect(t[1].style?.color).toBe("#f00");
    expect(t[2].style?.color).toBe("#f00");
    expect(t[3].style).toBeUndefined();
  });

  it("supports every marker", () => {
    expect(parseRich("==a==", marks)[0].style?.highlight).toBe("#ff0");
    expect(parseRich("__a__", marks)[0].style?.underline).toBe("#00f");
    expect(parseRich("~~a~~", marks)[0].style?.strike).toBe("#888");
  });

  it("treats an unclosed marker as literal text rather than swallowing the slide", () => {
    const t = parseRich("keep **all of this visible", marks);
    expect(t.map((x) => x.text).join(" ")).toBe("keep **all of this visible");
    expect(t.every((x) => x.style === undefined)).toBe(true);
  });

  it("nests markers", () => {
    const t = parseRich("**==both==**", marks);
    expect(t[0].style?.color).toBe("#f00");
    expect(t[0].style?.highlight).toBe("#ff0");
  });

  it("strips markup for word counts", () => {
    expect(plain("a **b** ==c== __d__ ~~e~~")).toBe("a b c d e");
  });
});

describe("wrapping", () => {
  const spec = { font: "sans", size: 40, weight: 700 };

  it("breaks lines at the box width", () => {
    const tokens = parseRich("one two three four five six seven eight nine ten", marks);
    const wide = wrapTokens(tokens, 10000, spec, metricMeasurer);
    const narrow = wrapTokens(tokens, 200, spec, metricMeasurer);
    expect(wide).toHaveLength(1);
    expect(narrow.length).toBeGreaterThan(2);
    for (const line of narrow) {
      // A line may only exceed the box when it holds a single unbreakable word.
      if (line.tokens.length > 1) expect(line.width).toBeLessThanOrEqual(200);
    }
  });

  it("never drops words", () => {
    const text = "the quick brown fox jumps over the lazy dog";
    const lines = wrapTokens(parseRich(text, marks), 180, spec, metricMeasurer);
    expect(lines.flatMap((l) => l.tokens.map((t) => t.text)).join(" ")).toBe(text);
  });

  it("honours explicit newlines", () => {
    expect(wrapRich("a\nb\nc", marks, 9999, spec, metricMeasurer)).toHaveLength(3);
  });

  it("gives an over-long word its own line instead of clipping it", () => {
    const lines = wrapTokens(parseRich("hi supercalifragilisticexpialidocious", marks), 60, spec, metricMeasurer);
    expect(lines).toHaveLength(2);
    expect(lines[1].tokens[0].text).toBe("supercalifragilisticexpialidocious");
  });
});

describe("shrink-to-fit", () => {
  const base = { font: "sans", weight: 800 };
  const opts = { maxWidth: 600, maxHeight: 300, max: 120, min: 24, lineHeight: 1.1 };

  it("keeps short text at the maximum size", () => {
    expect(fitText("Hi", marks, base, metricMeasurer, opts).size).toBe(120);
  });

  it("shrinks long text until it fits the box", () => {
    const long = "This is a considerably longer headline that has to be reduced to fit its box";
    const r = fitText(long, marks, base, metricMeasurer, opts);
    expect(r.size).toBeLessThan(120);
    expect(r.height).toBeLessThanOrEqual(opts.maxHeight);
  });

  it("reports overflow instead of silently clipping when even the minimum is too big", () => {
    const r = fitText("word ".repeat(400), marks, base, metricMeasurer, {
      ...opts,
      maxHeight: 40,
      min: 24,
    });
    expect(r.size).toBe(24);
    expect(r.overflow).toBe(true);
  });

  it("respects a maxLines budget when one is achievable", () => {
    const r = fitText("four words go here", marks, base, metricMeasurer, { ...opts, maxLines: 1 });
    expect(r.lines).toHaveLength(1);
  });
});

describe("cached measurer", () => {
  const spec = (over: Partial<FontSpec> = {}): FontSpec => ({
    font: "sans",
    size: 50,
    weight: 400,
    ...over,
  });
  // Stand-in for canvas measureText: 0.6em per character.
  const raw = (text: string, s: FontSpec) => text.length * s.size * 0.6;

  it("scales a cached size-100 measurement linearly with font size", () => {
    const m = makeCachedMeasurer(raw);
    expect(m.width("abcd", spec({ size: 100 }))).toBeCloseTo(240);
    expect(m.width("abcd", spec({ size: 50 }))).toBeCloseTo(120);
    expect(m.width("abcd", spec({ size: 25 }))).toBeCloseTo(60);
  });

  it("adds letter-spacing as a fixed per-character offset, not a scaled one", () => {
    const m = makeCachedMeasurer(raw);
    const plainW = m.width("abcd", spec({ size: 50 }));
    expect(m.width("abcd", spec({ size: 50, letterSpacing: 2 }))).toBeCloseTo(plainW + 8);
    // Regression: negative tracking must nudge the width, never invert it.
    const tight = m.width("abcd", spec({ size: 50, letterSpacing: -3 }));
    expect(tight).toBeCloseTo(plainW - 12);
    expect(tight).toBeGreaterThan(0);
  });

  it("keeps letter-spacing out of the cache so it cannot be size-scaled", () => {
    let calls = 0;
    const m = makeCachedMeasurer((t, s) => {
      calls++;
      expect(s.letterSpacing).toBe(0);
      expect(s.size).toBe(100);
      return raw(t, s);
    });
    m.width("abcd", spec({ size: 50, letterSpacing: -3 }));
    m.width("abcd", spec({ size: 90, letterSpacing: 4 }));
    expect(calls).toBe(1);
  });

  it("wraps sanely under tight negative tracking", () => {
    const m = makeCachedMeasurer(raw);
    const text = "Most advice about this topic starts in the wrong place entirely";
    const lines = wrapTokens(parseRich(text, marks), 600, spec({ size: 90, letterSpacing: -3 }), m);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(l.width).toBeGreaterThan(0);
    expect(lines.flatMap((l) => l.tokens.map((t) => t.text)).join(" ")).toBe(text);
  });

  it("evicts rather than growing without bound", () => {
    const m = makeCachedMeasurer(raw, 4);
    for (let i = 0; i < 20; i++) m.width(`w${i}`, spec());
    expect(m.width("w0", spec())).toBeCloseTo(raw("w0", spec()));
  });
});

describe("punctuation across markup boundaries", () => {
  const spec = { font: "sans", size: 40, weight: 700 };

  it("glues punctuation that hugged the closing marker", () => {
    const t = parseRich("Price the **Outcome**, not the hours", marks);
    expect(t.map((x) => x.text)).toEqual(["Price", "the", "Outcome", ",", "not", "the", "hours"]);
    expect(t[3].glue).toBe(true);
    expect(t[2].glue).toBeUndefined();
    expect(t[4].glue).toBeUndefined();
  });

  it("does not glue when the marker was followed by a space", () => {
    const t = parseRich("the **Outcome** not the hours", marks);
    expect(t.find((x) => x.text === "not")?.glue).toBeUndefined();
  });

  it("glues an opening bracket before a styled word", () => {
    const t = parseRich("call (**now**) today", marks);
    expect(t.map((x) => x.text)).toEqual(["call", "(", "now", ")", "today"]);
    expect(t[2].glue).toBe(true);
    expect(t[3].glue).toBe(true);
  });

  it("never wraps a glued token onto its own line", () => {
    const tokens = parseRich("Price the **Outcome**, not the hours", marks);
    // A width that would otherwise strand the comma at a line start.
    for (let w = 120; w <= 600; w += 20) {
      const lines = wrapTokens(tokens, w, spec, metricMeasurer);
      for (const line of lines) {
        expect(line.tokens[0]?.glue, `orphaned punctuation at width ${w}`).toBeUndefined();
      }
    }
  });

  it("keeps a glued token on the same line as the word it follows", () => {
    const tokens = parseRich("aaa bbb **ccc**, ddd", marks);
    const lines = wrapTokens(tokens, 200, spec, metricMeasurer);
    const withC = lines.find((l) => l.tokens.some((t) => t.text === "ccc"))!;
    expect(withC.tokens.map((t) => t.text)).toContain(",");
  });

  it("keeps line width consistent with how the painter advances", () => {
    const tokens = parseRich("one **two**, three", marks);
    const [line] = wrapTokens(tokens, 10000, spec, metricMeasurer);
    const space = metricMeasurer.width(" ", spec);
    let expected = 0;
    line.tokens.forEach((t, i) => {
      if (i > 0 && !t.glue) expected += space;
      expected += metricMeasurer.width(t.text, {
        ...spec,
        weight: t.style?.weight ?? spec.weight,
      });
    });
    expect(line.width).toBeCloseTo(expected, 5);
  });
});
