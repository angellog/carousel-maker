import { describe, expect, it, vi } from "vitest";
import { webResearcher } from "@/lib/providers/research/web";
import { getResearcher } from "@/lib/providers/research";
import type { ProviderEvent } from "@/lib/providers/types";

const WIKI_EXTRACT =
  "A solar panel is a device that converts sunlight into electricity by the photovoltaic effect. Panels are assembled into arrays to power homes and businesses reliably.";
const DDG_ABSTRACT = "A solar panel converts sunlight into electricity efficiently in most climates worldwide.";

function stub(opts: { ddgThrows?: boolean } = {}) {
  return vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/search/page")) {
      return new Response(JSON.stringify({ pages: [{ key: "Solar_panel", title: "Solar panel" }] }), { status: 200 });
    }
    if (u.includes("/page/summary/")) {
      return new Response(
        JSON.stringify({
          title: "Solar panel",
          extract: WIKI_EXTRACT,
          description: "Photovoltaic device",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Solar_panel" } },
        }),
        { status: 200 },
      );
    }
    if (u.includes("/w/api.php") && u.includes("prop=extracts")) {
      return new Response(
        JSON.stringify({
          query: {
            pages: {
              "123": {
                extract:
                  "A solar panel is a device that converts sunlight into electricity by the photovoltaic effect. Modern silicon panels reach around twenty percent efficiency in commercial modules today. Bifacial panels capture light on both faces to raise total yield noticeably.",
              },
            },
          },
        }),
        { status: 200 },
      );
    }
    if (u.includes("duckduckgo.com")) {
      if (opts.ddgThrows) throw new Error("ddg down");
      return new Response(
        JSON.stringify({
          Heading: "Solar panel",
          AbstractText: DDG_ABSTRACT,
          AbstractURL: "https://duckduckgo.com/Solar_panel",
          AbstractSource: "DuckDuckGo",
          RelatedTopics: [{ Text: "Solar power is renewable energy generated from the sun." }],
        }),
        { status: 200 },
      );
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
}

function ctx() {
  const events: ProviderEvent[] = [];
  return { events, emit: (e: ProviderEvent) => events.push(e) };
}

describe("web researcher", () => {
  it("merges Wikipedia and DuckDuckGo facts and sources", async () => {
    const { events, emit } = ctx();
    const r = await webResearcher.research("Solar panel", { emit, fetchImpl: stub() });
    const joined = r.facts.join(" ");
    expect(joined).toMatch(/photovoltaic effect/); // from Wikipedia
    expect(joined).toMatch(/efficiently in most climates/); // from DuckDuckGo
    const urls = r.sources.map((s) => s.url);
    expect(urls).toContain("https://en.wikipedia.org/wiki/Solar_panel");
    expect(urls).toContain("https://duckduckgo.com/Solar_panel");
    expect(events.some((e) => e.type === "source")).toBe(true);
  });

  it("de-duplicates facts across sources", async () => {
    const { emit } = ctx();
    const r = await webResearcher.research("Solar panel", { emit, fetchImpl: stub() });
    const keys = r.facts.map((f) => f.toLowerCase().slice(0, 40));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("still returns Wikipedia facts when DuckDuckGo fails", async () => {
    const { emit } = ctx();
    const r = await webResearcher.research("Solar panel", { emit, fetchImpl: stub({ ddgThrows: true }) });
    expect(r.facts.join(" ")).toMatch(/photovoltaic effect/);
    expect(r.sources.some((s) => s.url.includes("wikipedia"))).toBe(true);
  });

  it("deepens the primary article with its extended intro", async () => {
    const { emit } = ctx();
    const r = await webResearcher.research("Solar panel", { emit, fetchImpl: stub() });
    const joined = r.facts.join(" ");
    // A sentence that only exists in the extended extract, not the REST summary.
    expect(joined).toMatch(/twenty percent efficiency/);
    expect(joined).toMatch(/Bifacial panels/);
  });

  it("is selected by getResearcher('web')", () => {
    expect(getResearcher("web")).toBe(webResearcher);
    expect(getResearcher("none")).toBeNull();
  });
});
