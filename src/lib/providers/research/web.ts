/**
 * The `web` researcher: broader and deeper than Wikipedia-summaries alone, still
 * fully keyless.
 *
 * It combines three structured, keyless public sources — no scraping, so the
 * text is clean and attributable:
 *   1. Wikipedia REST summaries of the top matching articles (via researchTopic).
 *   2. The *extended* plaintext intro of the best article (Wikipedia's classic
 *      `extracts` API), which returns several times more than the ~3-sentence
 *      REST summary — this is where the extra depth comes from.
 *   3. DuckDuckGo's Instant Answer abstract as an independent cross-check.
 *
 * Everything fails soft: any source that errors or times out simply contributes
 * nothing and the others still stand.
 */

import { researchTopic, toSentences, type ResearchResult } from "../../content/research";
import type { Researcher } from "../types";

const WIKI = "https://en.wikipedia.org";
const DDG = "https://api.duckduckgo.com/";
const UA = "carousel-maker/1.0 (keyless research; contact via app)";

interface DdgResponse {
  Heading?: string;
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
}

interface ExtractResponse {
  query?: { pages?: Record<string, { extract?: string }> };
}

async function getJson<T>(url: string, fetchImpl: typeof fetch, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The fuller intro of one article — far more than the REST summary gives. */
async function extendedExtract(title: string, fetchImpl: typeof fetch, ms: number): Promise<string[]> {
  const url =
    `${WIKI}/w/api.php?action=query&format=json&origin=*&prop=extracts&explaintext=1&exchars=1600&redirects=1` +
    `&titles=${encodeURIComponent(title)}`;
  const data = await getJson<ExtractResponse>(url, fetchImpl, ms);
  const pages = data?.query?.pages;
  if (!pages) return [];
  const first = Object.values(pages)[0];
  return first?.extract ? toSentences(first.extract) : [];
}

async function duckDuckGo(topic: string, fetchImpl: typeof fetch, ms: number): Promise<Partial<ResearchResult>> {
  const url = `${DDG}?q=${encodeURIComponent(topic)}&format=json&no_html=1&skip_disambig=1`;
  const data = await getJson<DdgResponse>(url, fetchImpl, ms);
  if (!data?.AbstractText) return {};
  const sources = data.AbstractURL
    ? [{ title: data.AbstractSource || data.Heading || topic, url: data.AbstractURL }]
    : [];
  return { facts: toSentences(data.AbstractText), sources };
}

/**
 * Merge several partial results, deduping facts (by prefix) and sources (by URL)
 * while preserving each fact's link to the source it came from.
 */
function merge(parts: (ResearchResult | Partial<ResearchResult>)[]): ResearchResult {
  const out: ResearchResult = { lead: "", facts: [], sources: [], descriptions: [] };
  const factSources: number[] = [];
  const seenFact = new Set<string>();
  const sourceIndex = new Map<string, number>();
  for (const p of parts) {
    if (!out.lead && p.lead) out.lead = p.lead;
    for (const d of p.descriptions ?? []) out.descriptions.push(d);
    // Map this part's local source indices onto the merged source list.
    const localToMerged = (p.sources ?? []).map((src) => {
      const existing = sourceIndex.get(src.url);
      if (existing != null) return existing;
      const idx = out.sources.length;
      out.sources.push(src);
      sourceIndex.set(src.url, idx);
      return idx;
    });
    const facts = p.facts ?? [];
    for (let j = 0; j < facts.length; j++) {
      const key = facts[j].toLowerCase().slice(0, 40);
      if (seenFact.has(key)) continue;
      seenFact.add(key);
      out.facts.push(facts[j]);
      const local = p.factSources?.[j];
      const merged = local != null && localToMerged[local] != null ? localToMerged[local] : localToMerged[0] ?? 0;
      factSources.push(merged);
    }
  }
  out.factSources = factSources;
  return out;
}

export const webResearcher: Researcher = {
  source: "web",
  label: "Web (Wikipedia + DuckDuckGo)",
  async research(topic, ctx) {
    const fetchImpl = ctx.fetchImpl ?? fetch;
    ctx.emit({ type: "phase", phase: "research" });
    ctx.emit({ type: "search", query: `${topic} (web: Wikipedia + DuckDuckGo)` });

    const [wiki, ddg] = await Promise.all([
      researchTopic(topic, { fetchImpl }).catch(() => null),
      duckDuckGo(topic, fetchImpl, 6000).catch(() => ({}) as Partial<ResearchResult>),
    ]);

    // Deepen the best article with its extended intro (many more sentences).
    let deeper: string[] = [];
    const primary = wiki?.sources[0];
    if (primary) {
      deeper = await extendedExtract(primary.title, fetchImpl, 6000).catch(() => []);
    }
    // The extended-extract facts come from the primary article, so credit it.
    const deeperPart: Partial<ResearchResult> = primary
      ? { facts: deeper, sources: [primary], factSources: deeper.map(() => 0) }
      : { facts: deeper };

    const result = merge([wiki ?? {}, deeperPart, ddg]);
    for (const src of result.sources) ctx.emit({ type: "source", title: src.title, url: src.url });
    return result;
  },
};
