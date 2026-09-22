/**
 * The orchestrator. Given a request and the environment, it:
 *   1. resolves which Writer + Researcher run (config.ts),
 *   2. gathers facts if a researcher applies,
 *   3. runs the writer,
 *   4. falls back to the always-available template writer on any failure —
 *      re-running research for the draft if the user asked for it, so even a
 *      failed Claude call still yields a real, sourced keyless deck.
 *
 * It emits progress events but knows nothing about HTTP or SSE, which keeps it
 * unit-testable end to end with an injected fetch.
 */

import { getPreset } from "../presets";
import { writeOfflineDeck } from "../content/offline";
import type { GenerateInput } from "../content/prompt";
import type { ResearchResult } from "../content/research";
import type { DeckIssue } from "../content/schema";
import type { Deck } from "../types";
import { type Env, resolveConfig, type ResolvedConfig } from "./config";
import { getResearcher } from "./research";
import { getWriter, templateWriter } from "./writers";
import type { Emit, ResearchContext } from "./types";

export interface GenerateArgs {
  input: GenerateInput;
  env: Env;
  emit: Emit;
  signal?: AbortSignal;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface GenerateOutput {
  deck: Deck;
  issues?: DeckIssue[];
  config: ResolvedConfig;
}

function clampSlides(n: number): number {
  return Math.max(4, Math.min(12, Math.round(n || 9)));
}

async function runResearch(
  source: ReturnType<typeof getResearcher>,
  topic: string,
  ctx: ResearchContext,
): Promise<ResearchResult | undefined> {
  if (!source) return undefined;
  try {
    return await source.research(topic, ctx);
  } catch {
    // Research is always best-effort; a failure just means fewer facts.
    return undefined;
  }
}

export async function generateDeck(args: GenerateArgs): Promise<GenerateOutput> {
  const { input, env, emit, signal, fetchImpl } = args;
  const config = resolveConfig(input, env);
  const preset = getPreset(input.presetId);
  const slideCount = clampSlides(input.slideCount);
  const researchCtx: ResearchContext = { emit, signal, fetchImpl };

  // Facts for the primary writer (Claude searches itself, so `config.research`
  // is "none" for it and this is skipped).
  const research = await runResearch(getResearcher(config.research), input.topic, researchCtx);

  const writer = getWriter(config.writer);
  const primary = await writer.write({ input, preset, slideCount, research, emit, signal, fetchImpl });
  if (primary) return { deck: primary.deck, issues: primary.issues, config };

  // ---- Fallback: the template writer always produces a renderable deck. ----
  // When the primary writer fails we produce an honest skeleton rather than
  // pre-fetching keyless facts. The old fallback pulled Wikipedia/DuckDuckGo
  // summaries, which slopped conceptual and how-to topics with unrelated
  // articles — retired here to match the "no garbage or slop" bar. A failed
  // paid writer now yields a clean draft the user can edit or regenerate.
  const draft = await templateWriter.write({
    input,
    preset,
    slideCount,
    research,
    emit,
    signal,
    fetchImpl,
  });
  // templateWriter never returns null, but satisfy the type.
  const deck = draft?.deck ?? templateFallbackDeck(input, preset, slideCount);
  return { deck, issues: draft?.issues, config };
}

/** Extremely defensive: only reached if the template writer itself throws. */
function templateFallbackDeck(input: GenerateInput, preset: ReturnType<typeof getPreset>, slideCount: number): Deck {
  return writeOfflineDeck({ topic: input.topic, handle: input.handle, preset, slideCount, voiceId: input.voiceId });
}
