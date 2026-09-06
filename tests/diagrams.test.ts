import { describe, expect, it } from "vitest";
import { writeOfflineDeck } from "@/lib/content/offline";
import { getPreset, PRESETS } from "@/lib/presets";
import { makeCtx } from "@/lib/render/ctx";
import { arrow } from "@/lib/render/decor";
import { dataTable, naturalPanelHeight, panelGrid, rankRows, tableHeight } from "@/lib/render/diagrams";
import { metricMeasurer } from "@/lib/render/text";
import type { Node } from "@/lib/render/scene";
import { FONT_FALLBACKS, getPalette, type FontSet } from "@/lib/theme";
import type { SlidePanel, SlideRanked, SlideTable } from "@/lib/types";

const fonts = { ...FONT_FALLBACKS } as FontSet;

function ctx(presetId = "statlist") {
  const preset = getPreset(presetId);
  const deck = writeOfflineDeck({ topic: "Test", handle: "@x", preset, slideCount: 8 });
  return makeCtx({
    deck,
    slide: deck.slides[1],
    index: 1,
    total: 8,
    pal: getPalette(undefined, preset.defaultPalette),
    fonts,
    m: metricMeasurer,
  });
}

const BOX = { x: 80, y: 200, w: 900, h: 700 };

function textOf(nodes: Node[]): string[] {
  return nodes
    .filter((n): n is Extract<Node, { kind: "text" }> => n.kind === "text")
    .flatMap((n) => n.lines.map((l) => l.tokens.map((t) => t.text).join(" ")));
}

describe("arrow", () => {
  it("keeps the head proportional on short arrows", () => {
    const n = arrow(0, 0, 40, "#fff", 3) as Extract<Node, { kind: "path" }>;
    // Head reaches back from the tip; on a 40px arrow it should be ~17px.
    const xs = (n.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(Math.max(...xs)).toBeCloseTo(40, 0);
  });

  it("caps the head so a full-width connector does not sprout a giant chevron", () => {
    const long = arrow(0, 0, 900, "#fff", 3) as Extract<Node, { kind: "path" }>;
    // The back of the head must sit close to the tip, not 378px behind it.
    const m = /L (\d+(?:\.\d+)?) -?\d/.exec(long.d.split("M")[2] ?? "");
    const backX = m ? Number(m[1]) : 0;
    expect(900 - backX).toBeLessThan(40);
  });

  it("honours an explicit head size", () => {
    const n = arrow(0, 0, 200, "#fff", 3, 10) as Extract<Node, { kind: "path" }>;
    expect(n.d).toContain("190");
  });
});

describe("panel sizing", () => {
  const two: SlidePanel[] = [
    { title: "Do", items: ["a", "b"] },
    { title: "Skip", items: ["c"] },
  ];
  const many: SlidePanel[] = [{ title: "Do", items: ["a", "b", "c", "d", "e", "f"] }];

  it("grows with the number of items", () => {
    expect(naturalPanelHeight(many)).toBeGreaterThan(naturalPanelHeight(two));
  });

  it("never returns less than the floor", () => {
    expect(naturalPanelHeight([{ title: "x", items: [] }], 150)).toBe(150);
  });

  it("stops a sparse panel from stretching to fill the slide", () => {
    const nodes = panelGrid(ctx("panels"), BOX, two);
    const rects = nodes.filter((n): n is Extract<Node, { kind: "rect" }> => n.kind === "rect");
    const panelRect = rects[0];
    expect(panelRect.h).toBeLessThan(BOX.h * 0.6);
  });

  it("centres the panel row inside its box", () => {
    const nodes = panelGrid(ctx("panels"), BOX, two);
    const rects = nodes.filter((n): n is Extract<Node, { kind: "rect" }> => n.kind === "rect");
    const top = rects[0].y;
    const bottom = rects[0].y + rects[0].h;
    expect(top - BOX.y).toBeGreaterThan(1);
    expect(BOX.y + BOX.h - bottom).toBeGreaterThan(1);
  });

  it("renders every panel title and item", () => {
    const text = textOf(panelGrid(ctx("panels"), BOX, two)).join(" ");
    expect(text).toContain("DO");
    expect(text).toContain("SKIP");
    for (const w of ["a", "b", "c"]) expect(text.split(/\s+/)).toContain(w);
  });
});

describe("data table", () => {
  const table: SlideTable = {
    columns: ["Approach", "Effort", "Sticks?"],
    rows: [
      ["All at once", "High", "Rarely"],
      ["One habit", "Low", "Usually"],
    ],
  };

  it("draws every header and cell", () => {
    const text = textOf(dataTable(ctx("datatable"), BOX, table)).join(" | ");
    expect(text).toContain("APPROACH");
    expect(text).toContain("STICKS?");
    expect(text).toContain("All at once");
    expect(text).toContain("Usually");
  });

  it("reports a height that matches what it draws", () => {
    const h = tableHeight(ctx("datatable"), BOX, table);
    const nodes = dataTable(ctx("datatable"), BOX, table);
    const frame = nodes.filter((n): n is Extract<Node, { kind: "rect" }> => n.kind === "rect").at(-1)!;
    expect(frame.h).toBeCloseTo(h, 1);
    expect(h).toBeLessThanOrEqual(BOX.h);
  });

  it("caps at eight rows rather than overflowing", () => {
    const big: SlideTable = { columns: ["a", "b"], rows: Array.from({ length: 30 }, (_, i) => [`r${i}`, "x"]) };
    const text = textOf(dataTable(ctx("datatable"), BOX, big));
    expect(text).not.toContain("r9");
    expect(tableHeight(ctx("datatable"), BOX, big)).toBeLessThanOrEqual(BOX.h + 1);
  });
});

describe("rank rows", () => {
  const ranked: SlideRanked[] = [
    { label: "Consistency", value: "77%", note: "of people say so" },
    { label: "Clarity", value: "43%" },
    { label: "Review" },
  ];

  it("draws rank numbers, labels and values", () => {
    const text = textOf(rankRows(ctx("statlist"), BOX, ranked)).join(" | ");
    expect(text).toContain("CONSISTENCY");
    expect(text).toContain("77%");
    expect(text).toContain("of people say so");
    expect(text).toContain("1");
    expect(text).toContain("3");
  });

  it("stays inside its box", () => {
    const nodes = rankRows(ctx("statlist"), BOX, ranked);
    const rects = nodes.filter((n): n is Extract<Node, { kind: "rect" }> => n.kind === "rect");
    for (const r of rects) {
      expect(r.y).toBeGreaterThanOrEqual(BOX.y - 1);
      expect(r.y + r.h).toBeLessThanOrEqual(BOX.y + BOX.h + 1);
    }
  });

  it("handles an entry with no value", () => {
    expect(() => rankRows(ctx("statlist"), BOX, [{ label: "Solo" }])).not.toThrow();
  });
});

describe("structured fields reach the presets that ask for them", () => {
  it("every preset needing table/panels/ranked gets them from the offline writer", () => {
    for (const p of PRESETS) {
      const deck = writeOfflineDeck({ topic: "T", preset: p, slideCount: 8 });
      const body = deck.slides.filter((s) => s.role === "body");
      for (const field of ["table", "panels", "ranked"] as const) {
        if (!p.needs.includes(field)) continue;
        expect(body.some((s) => s[field] != null), `${p.id} missing ${field}`).toBe(true);
      }
    }
  });
});
