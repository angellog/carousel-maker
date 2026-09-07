import type { Researcher, ResearchSource } from "../types";
import { wikipediaResearcher } from "./wikipedia";
import { webResearcher } from "./web";

/** Map a resolved source to its researcher. `none` has no researcher. */
export function getResearcher(source: ResearchSource): Researcher | null {
  switch (source) {
    case "wikipedia":
      return wikipediaResearcher;
    case "web":
      return webResearcher;
    default:
      return null;
  }
}

export { wikipediaResearcher, webResearcher };
