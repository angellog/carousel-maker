import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserPrompt, DECK_TOOL_SCHEMA } from "../../content/prompt";
import { deckSchema, normalizeDeck } from "../../content/schema";
import { friendlyError } from "../../content/errors";
import type { Writer, WriteContext, WriteResult } from "../types";
import type { WriterConfig } from "../config";

/**
 * The Claude writer. Highest quality, and the only writer that researches the
 * web itself (via Anthropic's server-side web_search tool) rather than being
 * handed facts. Used for both bring-your-own-key and the hosted server key —
 * the only difference between those is whose key `config.apiKey` holds, which
 * the rate limiter (not this writer) accounts for.
 *
 * Returns null when the model never submits a usable deck, so the orchestrator
 * falls back to the template writer instead of showing an error to the user.
 */
export function makeClaudeWriter(config: WriterConfig): Writer {
  const model = config.model || "claude-sonnet-5";
  return {
    kind: "claude",
    label: config.label,
    async write(ctx: WriteContext): Promise<WriteResult | null> {
      const { input, preset, slideCount, emit } = ctx;
      const client = new Anthropic({ apiKey: config.apiKey });
      const system = buildSystemPrompt(preset, { ...input, slideCount });

      const attempt = async (withSearch: boolean) => {
        emit({ type: "phase", phase: withSearch ? "research" : "writing" });
        const tools: Anthropic.Messages.ToolUnion[] = [];
        if (withSearch) {
          tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 4 } as Anthropic.Messages.ToolUnion);
        }
        tools.push({
          name: "submit_deck",
          description: "Submit the finished carousel deck. Call this exactly once, at the end.",
          input_schema: DECK_TOOL_SCHEMA,
        } as Anthropic.Messages.ToolUnion);

        const ms = client.messages.stream({
          model,
          // A 12-slide deck plus search results overflows 8k, and running out
          // mid-tool-call loses the whole deck.
          max_tokens: 24000,
          system,
          messages: [{ role: "user", content: buildUserPrompt({ ...input, slideCount, research: withSearch }) }],
          tools,
        });

        const partials = new Map<number, { name: string; json: string }>();
        for await (const event of ms) {
          if (event.type === "content_block_start") {
            const b = event.content_block as { type: string; name?: string };
            if (b.type === "server_tool_use" || b.type === "tool_use") {
              partials.set(event.index, { name: b.name ?? "", json: "" });
              if (b.name === "submit_deck") emit({ type: "phase", phase: "writing" });
            }
          } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
            const p = partials.get(event.index);
            if (p) p.json += event.delta.partial_json;
          } else if (event.type === "content_block_stop") {
            const p = partials.get(event.index);
            if (p?.name === "web_search") {
              try {
                const parsed = JSON.parse(p.json) as { query?: string };
                if (parsed.query) emit({ type: "search", query: parsed.query });
              } catch {
                /* partial JSON that never completed */
              }
            }
          }
        }

        const final = await ms.finalMessage();
        for (const b of final.content) {
          if ((b as { type: string }).type === "web_search_tool_result") {
            const res = (b as unknown as { content?: { title?: string; url?: string }[] }).content;
            if (Array.isArray(res)) {
              for (const r of res.slice(0, 6)) {
                if (r.url) emit({ type: "source", title: r.title ?? r.url, url: r.url });
              }
            }
          }
        }
        const call = final.content.find(
          (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "submit_deck",
        );
        return { call, stopReason: final.stop_reason };
      };

      try {
        let { call } = await attempt(input.research);
        if (!call && input.research) {
          // Search ate the output budget. Rather than dropping to the skeleton,
          // write it again from the model's own knowledge.
          emit({ type: "notice", message: "Research ran long, so the deck was written without search." });
          ({ call } = await attempt(false));
        }
        if (!call) return null;

        const parsed = deckSchema.safeParse({ ...(call.input as object), handle: input.handle });
        if (!parsed.success) {
          emit({
            type: "notice",
            message: `The model's deck failed validation (${parsed.error.issues
              .slice(0, 2)
              .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
              .join("; ")}), so the built-in draft was used instead.`,
          });
          return null;
        }

        const { deck, issues } = normalizeDeck(parsed.data, { handle: input.handle ?? "", topic: input.topic });
        deck.engineKind = "claude";
        deck.engine = config.label;
        return { deck, issues };
      } catch (err) {
        emit({ type: "error", message: friendlyError(err, model) });
        return null;
      }
    },
  };
}
