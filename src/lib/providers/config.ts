/**
 * Resolves, from the environment and a single request, exactly which Writer and
 * Researcher run — and whether the request spends *our* money (so the rate
 * limiter knows what to protect).
 *
 * Writer precedence, highest first:
 *   1. A key the user typed in for this request  → Claude, billed to them (BYOK).
 *   2. A server Anthropic key                    → Claude, billed to us (hosted).
 *   3. A configured OpenAI-compatible endpoint   → open-source / hosted OSS model.
 *   4. Nothing                                   → the keyless template writer.
 */

import { sanitizeKey } from "../content/errors";
import type { GenerateInput } from "../content/prompt";
import type { ResearchSource, WriterKind } from "./types";

export interface Env {
  CAROUSEL_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  CAROUSEL_MODEL?: string;
  CAROUSEL_OSS_BASE_URL?: string;
  CAROUSEL_OSS_MODEL?: string;
  CAROUSEL_OSS_API_KEY?: string;
  CAROUSEL_OSS_LABEL?: string;
  CAROUSEL_RESEARCH_SOURCE?: string;
}

export interface WriterConfig {
  kind: WriterKind;
  /** Display label for the UI ("Claude Sonnet 5", "Llama 3.3 (Groq)", "Wikipedia draft"). */
  label: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  /** True when the user supplied the key for this request (their spend, not ours). */
  byok: boolean;
  /** True when producing this deck costs *us* money — the rate limiter guards these. */
  serverPaid: boolean;
}

export interface ResolvedConfig {
  writer: WriterConfig;
  /** Which researcher to run. `none` when research is off or the writer searches itself. */
  research: ResearchSource;
}

const DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Strip a key of surrounding quotes and every whitespace / control / separator
 * character — including U+2028/U+2029, which a copy-paste into a hosting
 * dashboard can smuggle in invisibly and which would otherwise crash the
 * Authorization header ("Cannot convert argument to a ByteString"). Real keys
 * are visible ASCII, so this never harms a valid one.
 */
function cleanKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const k = raw.replace(/^["']|["']$/g, "").replace(/[\s\x00-\x1F\x7F-\x9F]/g, "");
  return k || undefined;
}

function ossLabel(env: Env): string {
  if (env.CAROUSEL_OSS_LABEL) return env.CAROUSEL_OSS_LABEL;
  // Strip any provider prefix ("openai/gpt-oss-120b" → "gpt-oss-120b").
  const model = (env.CAROUSEL_OSS_MODEL ?? "model").split("/").pop() as string;
  // Name the host from the base URL so the UI can say where the brain lives.
  let host = "";
  try {
    host = new URL(env.CAROUSEL_OSS_BASE_URL ?? "").host.replace(/^api\./, "");
  } catch {
    /* leave host blank on a malformed URL */
  }
  const hostName = host ? host.split(".")[0].replace(/^\w/, (ch) => ch.toUpperCase()) : "";
  return hostName ? `${model} · ${hostName}` : model;
}

export function pickResearchSource(input: GenerateInput, env: Env): ResearchSource {
  if (!input.research) return "none";
  // One research mode now: "web". The old keyless Wikipedia source was retired
  // because it returned unrelated articles for conceptual topics.
  return "web";
}

export function resolveConfig(input: GenerateInput, env: Env): ResolvedConfig {
  const model = env.CAROUSEL_MODEL || DEFAULT_MODEL;
  const byokKey = sanitizeKey(input.apiKey);
  const serverAnthropic = cleanKey(env.CAROUSEL_API_KEY || env.ANTHROPIC_API_KEY);
  const ossKey = cleanKey(env.CAROUSEL_OSS_API_KEY);
  const ossConfigured = !!(env.CAROUSEL_OSS_BASE_URL && env.CAROUSEL_OSS_MODEL);

  // Research is now the writer's own job: Claude searches the live web itself,
  // and the OSS/template writers establish facts from their own knowledge. We
  // no longer pre-fetch a keyless source (retired Wikipedia — it slopped
  // conceptual topics with unrelated articles). `input.research` still gates
  // whether the model does a facts-first pass (see the writer prompt).
  const researchForWriter = (_writerKind: WriterKind): ResearchSource => "none";

  if (byokKey) {
    return {
      writer: { kind: "claude", label: labelForClaude(model), model, apiKey: byokKey, byok: true, serverPaid: false },
      research: researchForWriter("claude"),
    };
  }
  if (serverAnthropic) {
    return {
      writer: { kind: "claude", label: labelForClaude(model), model, apiKey: serverAnthropic, byok: false, serverPaid: true },
      research: researchForWriter("claude"),
    };
  }
  if (ossConfigured) {
    return {
      writer: {
        kind: "openai",
        label: ossLabel(env),
        model: env.CAROUSEL_OSS_MODEL,
        apiKey: ossKey,
        baseUrl: env.CAROUSEL_OSS_BASE_URL,
        byok: false,
        // A hosted OSS endpoint with a key costs us money; a local one (no key,
        // e.g. Ollama) does not, so it needs no rate limit.
        serverPaid: !!ossKey,
      },
      research: researchForWriter("openai"),
    };
  }
  return {
    writer: { kind: "template", label: "Public sources", byok: false, serverPaid: false },
    research: researchForWriter("template"),
  };
}

function labelForClaude(model: string): string {
  // "claude-sonnet-5" → "Claude Sonnet 5"
  return model
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

/** Read the process environment into a typed Env (server-side only). */
export function envFromProcess(): Env {
  return {
    CAROUSEL_API_KEY: process.env.CAROUSEL_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    CAROUSEL_MODEL: process.env.CAROUSEL_MODEL,
    CAROUSEL_OSS_BASE_URL: process.env.CAROUSEL_OSS_BASE_URL,
    CAROUSEL_OSS_MODEL: process.env.CAROUSEL_OSS_MODEL,
    CAROUSEL_OSS_API_KEY: process.env.CAROUSEL_OSS_API_KEY,
    CAROUSEL_OSS_LABEL: process.env.CAROUSEL_OSS_LABEL,
    CAROUSEL_RESEARCH_SOURCE: process.env.CAROUSEL_RESEARCH_SOURCE,
  };
}
