/**
 * Keyless research via free public knowledge APIs (the kind catalogued at
 * github.com/public-apis/public-apis). This powers the app's free tier: no
 * Anthropic key required, and every source is real and attributable.
 *
 * Source: Wikipedia's REST API — no auth, no key, stable, CC BY-SA content.
 *   - search:  /w/rest.php/v1/search/page
 *   - summary: /api/rest_v1/page/summary/{title}
 *
 * Everything here fails soft: any network or parse error yields an empty
 * result, never a throw, so the offline writer can always continue.
 */

export interface ResearchFact {
  text: string;
  /** Index into `sources`. */
  source: number;
}

export interface ResearchResult {
  /** One-paragraph lead from the best-matching article. */
  lead: string;
  /** Substantive sentences pulled from article extracts. */
  facts: string[];
  /**
   * For each entry in `facts`, the index into `sources` it was drawn from, so a
   * slide can credit the exact article. Same length as `facts` when present; the
   * real researchers always populate it, but it is optional so hand-built
   * results (and older callers) stay valid.
   */
  factSources?: number[];
  sources: { title: string; url: string }[];
  /** Short descriptors ("American technology company") for cover copy. */
  descriptions: string[];
}

const EMPTY: ResearchResult = { lead: "", facts: [], factSources: [], sources: [], descriptions: [] };

const WIKI = "https://en.wikipedia.org";
const UA = "carousel-maker/1.0 (keyless research; contact via app)";

type FetchLike = typeof fetch;

async function getJson<T>(url: string, fetchImpl: FetchLike, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetchImpl(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SearchResp {
  pages?: { key: string; title: string; excerpt?: string; description?: string }[];
}
interface SummaryResp {
  title?: string;
  extract?: string;
  description?: string;
  content_urls?: { desktop?: { page?: string } };
}

/** Split an extract into clean, self-contained sentences worth putting on a slide. */
export function toSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    // Protect common abbreviations so they don't trigger a split.
    .replace(/\b(e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|No)\./gi, "$1<dot>")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/<dot>/g, ".").trim())
    .filter((s) => {
      if (s.length < 30 || s.length > 220) return false;
      // Drop sentences that are mostly parenthetical pronunciation or citations.
      if (/^\(/.test(s)) return false;
      // Drop personal-pronoun-led orphans ("He also dealt with the Apollo 1
      // fire"): they need a human antecedent a standalone slide can't supply,
      // and they're how a namesake's biography leaks into an on-topic deck.
      if (/^(He|She|They|His|Her|Their|Him|Them)\b/.test(s)) return false;
      const words = s.split(/\s+/).length;
      return words >= 6 && words <= 34;
    });
}

/** Significant lowercased tokens from the topic, for relevance matching. */
const STOPWORDS = new Set(["the", "and", "for", "with", "from", "your", "that", "this", "into", "how", "why", "what", "when"]);
function topicTokens(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

/**
 * Research a topic against Wikipedia. `fetchImpl` is injectable for tests.
 * `signal` is honoured so a cancelled request tears the calls down.
 */
export async function researchTopic(
  topic: string,
  opts?: { fetchImpl?: FetchLike; timeoutMs?: number; maxArticles?: number },
): Promise<ResearchResult> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? 6000;
  const maxArticles = opts?.maxArticles ?? 5;
  const q = topic.trim();
  if (!q) return EMPTY;

  const search = await getJson<SearchResp>(
    `${WIKI}/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=6`,
    fetchImpl,
    timeoutMs,
  );
  const pages = search?.pages ?? [];
  if (pages.length === 0) return EMPTY;

  const summaries = await Promise.all(
    pages.slice(0, maxArticles).map((p) =>
      getJson<SummaryResp>(
        `${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(p.key)}`,
        fetchImpl,
        timeoutMs,
      ),
    ),
  );

  const sources: { title: string; url: string }[] = [];
  const facts: string[] = [];
  const factSources: number[] = [];
  const descriptions: string[] = [];
  let lead = "";
  const seen = new Set<string>();
  const tokens = topicTokens(q);

  // Guard against a whiffed search. When a topic has no Wikipedia article (most
  // how-to and opinion topics), the search still returns *something* as the top
  // hit — often an unrelated person or band. If even that top hit shares no
  // topic token in its title/description/excerpt, we must NOT trust it: treat it
  // like a secondary hit (filter its sentences, take no lead), so the writer
  // falls back to an honest draft instead of an off-topic one about a stranger.
  const primaryText = `${pages[0]?.title ?? ""} ${pages[0]?.description ?? ""} ${pages[0]?.excerpt ?? ""} ${summaries[0]?.description ?? ""}`.toLowerCase();
  // Match on a 5-char stem so plurals/inflections count ("habits" → "habit",
  // "cleaning" → "clean") while a genuine miss ("sneakers" vs a person) still
  // fails. A coarse gate: a false match just means we trust the article.
  const stem = (t: string) => t.slice(0, 5);
  const primaryRelevant = tokens.length === 0 || tokens.some((t) => primaryText.includes(stem(t)));

  summaries.forEach((sum, i) => {
    if (!sum?.extract) return;
    const url = sum.content_urls?.desktop?.page ?? `${WIKI}/wiki/${encodeURIComponent(pages[i].key)}`;
    const sourceIdx = sources.length;
    // A trusted top hit is the topic itself, so every sentence is on-topic.
    // Secondary hits (and an untrusted top hit) are only "related" — a namesake,
    // a sub-article, or an unrelated search miss. A namesake ("James E. Webb")
    // shares the *name* tokens but never the topic-distinctive ones ("space",
    // "telescope"), so require a sentence to carry a topic token that isn't part
    // of this article's own title. That keeps genuine sub-articles ("Webb's
    // First Deep Field") and drops the person the thing is named after.
    const trust = i === 0 && primaryRelevant;
    if (sum.description && (trust || i !== 0)) descriptions.push(sum.description);
    // The lead anchors the cover, so only take it from a trusted top hit.
    if (!lead && trust) lead = sum.extract.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").trim();
    const titleTokens = new Set(topicTokens(sum.title ?? pages[i].title));
    const distinctive = tokens.filter((t) => !titleTokens.has(t));
    const bar = distinctive.length > 0 ? distinctive : tokens;
    const onTopic = (s: string) => {
      if (bar.length === 0) return true;
      const low = s.toLowerCase();
      return bar.some((t) => low.includes(t));
    };
    let kept = 0;
    for (const sentence of toSentences(sum.extract)) {
      if (!trust && !onTopic(sentence)) continue;
      const key = sentence.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      facts.push(sentence);
      factSources.push(sourceIdx);
      kept++;
    }
    // Only cite an article we actually drew a fact from.
    if (kept > 0) sources.push({ title: sum.title ?? pages[i].title, url });
  });

  return { lead, facts, factSources, sources, descriptions };
}
