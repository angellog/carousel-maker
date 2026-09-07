import { researchTopic } from "../../content/research";
import type { Researcher } from "../types";

/** The keyless default: real, attributable facts from Wikipedia's REST API. */
export const wikipediaResearcher: Researcher = {
  source: "wikipedia",
  label: "Wikipedia",
  async research(topic, ctx) {
    ctx.emit({ type: "phase", phase: "research" });
    ctx.emit({ type: "search", query: `${topic} (Wikipedia)` });
    const result = await researchTopic(topic, { fetchImpl: ctx.fetchImpl ?? fetch });
    for (const src of result.sources) ctx.emit({ type: "source", title: src.title, url: src.url });
    return result;
  },
};
