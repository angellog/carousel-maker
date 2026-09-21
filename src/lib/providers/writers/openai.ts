/**
 * The open-source / hosted-OSS writer.
 *
 * Speaks the OpenAI Chat Completions API, which is the lingua franca of nearly
 * every model host — Groq, Together, OpenRouter, Fireworks, a local Ollama, and
 * OpenAI itself all accept the same request shape. One adapter, any of them,
 * configured by base URL + model (+ optional key).
 *
 * These models can't browse, so when research is on the orchestrator hands us
 * the facts and we ground the prompt on them. We ask for the deck via a
 * `submit_deck` function call, and fall back to parsing a JSON object out of the
 * message content when a host doesn't do tool calls — so it still works against
 * the widest possible set of endpoints.
 */

import { buildSystemPrompt, buildUserPrompt, DECK_TOOL_SCHEMA } from "../../content/prompt";
import { deckSchema, normalizeDeck } from "../../content/schema";
import type { Writer, WriteContext, WriteResult } from "../types";
import type { WriterConfig } from "../config";

interface ChatToolCall {
  function?: { name?: string; arguments?: string };
}
interface ChatResponse {
  choices?: { message?: { content?: string | null; tool_calls?: ChatToolCall[] } }[];
  error?: { message?: string } | string;
}

/** Pull the first balanced JSON object out of arbitrary text. */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export function makeOpenAIWriter(config: WriterConfig): Writer {
  const model = config.model || "gpt-4o-mini";
  const base = (config.baseUrl || "").replace(/\/+$/, "");
  // Defense in depth: the Authorization header must be a valid ByteString, so
  // drop any non-visible-ASCII the key might carry (config also cleans it).
  const authKey = config.apiKey?.replace(/[^\x21-\x7E]/g, "");
  return {
    kind: "openai",
    label: config.label,
    async write(ctx: WriteContext): Promise<WriteResult | null> {
      const { input, preset, slideCount, emit, research } = ctx;
      const fetchImpl = ctx.fetchImpl ?? fetch;
      emit({ type: "phase", phase: "writing" });

      const system =
        buildSystemPrompt(preset, { ...input, slideCount }) +
        "\n\nReturn the deck by calling the `submit_deck` function. If you cannot " +
        "call a function, reply with ONLY the deck as a raw JSON object matching " +
        "the same schema — no prose, no markdown fences.";
      const user = buildUserPrompt(
        { ...input, slideCount, research: false },
        research && research.facts.length > 0 ? { facts: research.facts, sources: research.sources } : {},
      );

      const body = {
        model,
        max_tokens: 8000,
        temperature: 0.6,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_deck",
              description: "Submit the finished carousel deck.",
              parameters: DECK_TOOL_SCHEMA,
            },
          },
        ],
        tool_choice: "auto",
      };

      // Hosts hiccup: a transient 429/5xx — and, seen in practice on Groq, an
      // occasional 400 under load — should not drop the user to the offline
      // draft. Retry a couple of times with a short backoff before giving up.
      const transient = (status: number) => status === 429 || status === 400 || status >= 500;
      const doFetch = () =>
        fetchImpl(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
          },
          body: JSON.stringify(body),
          signal: ctx.signal,
        });

      let data: ChatResponse;
      let res: Response;
      const MAX_ATTEMPTS = 3;
      for (let attempt = 1; ; attempt++) {
        try {
          res = await doFetch();
        } catch (err) {
          if (ctx.signal?.aborted) return null;
          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
          emit({ type: "notice", message: `Couldn't reach ${config.label} (${err instanceof Error ? err.message : "network error"}); used the built-in draft instead.` });
          return null;
        }
        if (res.ok) break;
        if (attempt < MAX_ATTEMPTS && transient(res.status) && !ctx.signal?.aborted) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
          continue;
        }
        const detail = await res.text().catch(() => "");
        emit({ type: "notice", message: openaiError(res.status, detail, config.label) });
        return null;
      }
      try {
        data = (await res.json()) as ChatResponse;
      } catch {
        emit({ type: "notice", message: `${config.label} sent an unreadable response, so the built-in draft was used.` });
        return null;
      }

      const message = data.choices?.[0]?.message;
      let raw: string | null = null;
      const toolCall = message?.tool_calls?.find((t) => t.function?.name === "submit_deck");
      if (toolCall?.function?.arguments) {
        raw = toolCall.function.arguments;
      } else if (typeof message?.content === "string") {
        raw = extractJsonObject(message.content);
      }
      if (!raw) {
        emit({ type: "notice", message: `${config.label} didn't return a usable deck, so the built-in draft was used.` });
        return null;
      }

      let obj: unknown;
      try {
        obj = JSON.parse(raw);
      } catch {
        const salvaged = extractJsonObject(raw);
        if (!salvaged) {
          emit({ type: "notice", message: `${config.label}'s deck wasn't valid JSON, so the built-in draft was used.` });
          return null;
        }
        try {
          obj = JSON.parse(salvaged);
        } catch {
          emit({ type: "notice", message: `${config.label}'s deck wasn't valid JSON, so the built-in draft was used.` });
          return null;
        }
      }

      const parsed = deckSchema.safeParse({ ...(obj as object), handle: input.handle });
      if (!parsed.success) {
        emit({
          type: "notice",
          message: `${config.label}'s deck failed validation, so the built-in draft was used instead.`,
        });
        return null;
      }

      const { deck, issues } = normalizeDeck(parsed.data, { handle: input.handle ?? "", topic: input.topic });
      deck.engineKind = "openai";
      deck.engine = config.label;
      // Cite ONLY the sources the model itself referenced. Keyless research is
      // handed to the model as optional grounding, but for common topics it
      // writes from its own knowledge and ignores those facts — so attaching the
      // fetched sources would be a false citation (e.g. crediting "Porphyria" on
      // an intermittent-fasting deck). Honesty over coverage.
      if (input.researchSource) deck.researchSource = input.researchSource;
      return { deck, issues };
    },
  };
}

function openaiError(status: number, detail: string, label: string): string {
  const lower = detail.toLowerCase();
  if (status === 401 || lower.includes("invalid api key") || lower.includes("unauthorized")) {
    return `${label} rejected the API key — check CAROUSEL_OSS_API_KEY. Used the built-in draft instead.`;
  }
  if (status === 404 || lower.includes("model")) {
    return `${label} couldn't find that model — check CAROUSEL_OSS_MODEL. Used the built-in draft instead.`;
  }
  if (status === 429) {
    return `${label} is rate limited right now, so the built-in draft was used. Try again shortly.`;
  }
  return `${label} returned an error (${status}), so the built-in draft was used.`;
}
