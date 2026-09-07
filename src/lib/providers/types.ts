/**
 * The provider spine.
 *
 * The "brain" behind a carousel is two independent choices, not one:
 *
 *   Axis A — the Writer: who turns a topic (and facts) into finished copy.
 *              `claude` · `openai` (any OpenAI-compatible / open-source model) · `template`
 *   Axis B — the Research source: where the facts come from.
 *              `none` · `wikipedia` · `web`
 *
 * Every "mode" a user can run in is just a point on that grid:
 *   - Keyless free tier   = template + wikipedia
 *   - Bring-your-own-key  = claude (user's key) + its own web search
 *   - Hosted (our key)    = claude (server key) + web search, behind a rate limit
 *   - Open-source brain   = openai (Groq/Together/OpenRouter/Ollama) + wikipedia|web
 *   - Live internet       = any writer + the `web` researcher
 *
 * Writers and researchers are small, swappable adapters behind these interfaces,
 * so adding a brain is an adapter, never a rewrite.
 */

import type { Deck } from "../types";
import type { Preset } from "../presets/types";
import type { GenerateInput } from "../content/prompt";
import type { ResearchResult } from "../content/research";
import type { DeckIssue } from "../content/schema";

export type WriterKind = "claude" | "openai" | "template";
export type ResearchSource = "none" | "wikipedia" | "web";

/** Progress events a provider streams back while it works. */
export type ProviderEvent =
  | { type: "phase"; phase: "research" | "writing"; detail?: string }
  | { type: "search"; query: string }
  | { type: "source"; title: string; url: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

export type Emit = (e: ProviderEvent) => void;

/** Everything a writer needs to produce a deck. */
export interface WriteContext {
  input: GenerateInput;
  preset: Preset;
  slideCount: number;
  /** Facts already gathered by a researcher, if any. */
  research?: ResearchResult;
  emit: Emit;
  signal?: AbortSignal;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

export interface WriteResult {
  deck: Deck;
  issues?: DeckIssue[];
}

/**
 * A Writer turns a topic into a Deck. It returns `null` (rather than throwing)
 * when it cannot produce a deck, so the orchestrator can fall back cleanly to
 * the always-available template writer.
 */
export interface Writer {
  kind: WriterKind;
  /** Human label shown in the UI, e.g. "Claude Sonnet 5" or "Llama 3.3 (Groq)". */
  label: string;
  write(ctx: WriteContext): Promise<WriteResult | null>;
}

export interface ResearchContext {
  emit: Emit;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

/** A Researcher gathers real, attributable facts for a topic. Fails soft. */
export interface Researcher {
  source: ResearchSource;
  label: string;
  research(topic: string, ctx: ResearchContext): Promise<ResearchResult>;
}
