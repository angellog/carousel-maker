import { writeOfflineDeck } from "../../content/offline";
import type { Writer } from "../types";

/**
 * The keyless writer. Always available, spends nobody's money, and — when a
 * researcher supplied facts — leads slides with real, sourced claims instead of
 * placeholders. This is both the free tier and the universal fallback for every
 * other writer.
 */
export const templateWriter: Writer = {
  kind: "template",
  label: "Public sources",
  async write(ctx) {
    ctx.emit({ type: "phase", phase: "writing" });
    const deck = writeOfflineDeck({
      topic: ctx.input.topic,
      audience: ctx.input.audience,
      handle: ctx.input.handle,
      preset: ctx.preset,
      slideCount: ctx.slideCount,
      research: ctx.research,
    });
    deck.engineKind = "template";
    deck.engine = deck.enriched ? "Public sources" : "Draft skeleton";
    if (ctx.input.researchSource) deck.researchSource = ctx.input.researchSource;
    return { deck };
  },
};
