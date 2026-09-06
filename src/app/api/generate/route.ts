import Anthropic from "@anthropic-ai/sdk";
import { getPreset } from "@/lib/presets";
import { buildSystemPrompt, buildUserPrompt, DECK_TOOL_SCHEMA, type GenerateInput } from "@/lib/content/prompt";
import { deckSchema, normalizeDeck } from "@/lib/content/schema";
import { writeOfflineDeck } from "@/lib/content/offline";
import { friendlyError, sanitizeKey } from "@/lib/content/errors";
import { researchTopic } from "@/lib/content/research";

export const runtime = "nodejs";
export const maxDuration = 300;

const MODEL = process.env.CAROUSEL_MODEL || "claude-sonnet-5";

type Event =
  | { type: "phase"; phase: string; detail?: string }
  | { type: "search"; query: string }
  | { type: "source"; title: string; url: string }
  | { type: "deck"; deck: unknown; issues?: unknown[] }
  | { type: "notice"; message: string }
  | { type: "error"; message: string };

function sse(controller: ReadableStreamDefaultController, e: Event) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`));
}


export async function POST(req: Request) {
  let input: GenerateInput;
  try {
    input = (await req.json()) as GenerateInput;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
  }
  if (!input?.topic?.trim()) {
    return new Response(JSON.stringify({ error: "A topic is required." }), { status: 400 });
  }

  const preset = getPreset(input.presetId);
  const slideCount = Math.max(4, Math.min(12, Math.round(input.slideCount || 9)));
  // Precedence: a key the user typed into the app for this request, then
  // CAROUSEL_API_KEY, then ANTHROPIC_API_KEY. CAROUSEL_API_KEY exists because
  // Next.js will not let .env.local override an ANTHROPIC_API_KEY already in
  // the process environment, which a parent shell or tool may have injected.
  //
  // A request key is used and discarded: it is never written to disk, never
  // logged, and never echoed back in a response.
  const apiKey =
    sanitizeKey(input.apiKey) || process.env.CAROUSEL_API_KEY || process.env.ANTHROPIC_API_KEY;

  const stream = new ReadableStream({
    async start(controller) {
      /**
       * The free path and every fallback land here. When research is on and no
       * model is available, pull real facts from Wikipedia (keyless) so the
       * built-in writer produces sourced copy rather than placeholders.
       */
      const finishKeyless = async (message: string) => {
        if (message) sse(controller, { type: "notice", message });
        let research;
        if (input.research) {
          sse(controller, { type: "phase", phase: "research" });
          sse(controller, { type: "search", query: `${input.topic} (public sources)` });
          try {
            research = await researchTopic(input.topic, { fetchImpl: fetch });
            for (const src of research.sources) {
              sse(controller, { type: "source", title: src.title, url: src.url });
            }
          } catch {
            /* research is best-effort; fall through to placeholders */
          }
        }
        const deck = writeOfflineDeck({
          topic: input.topic,
          audience: input.audience,
          handle: input.handle,
          preset,
          slideCount,
          research,
        });
        sse(controller, { type: "deck", deck });
        controller.close();
      };
      const finishOffline = (message: string) => {
        void finishKeyless(message);
      };

      if (!apiKey) {
        await finishKeyless(
          input.research
            ? "No API key, so this deck was drafted from public sources (Wikipedia) — free, no key needed. Add a key under Options → API key for AI-written copy."
            : "No API key, so this is the built-in draft. Turn on research for free Wikipedia-sourced facts, or add a key under Options → API key.",
        );
        return;
      }

      try {
        const client = new Anthropic({ apiKey });
        const system = buildSystemPrompt(preset, { ...input, slideCount });

        /**
         * Run one generation pass. Returns the submit_deck payload, or null if
         * the model never got there (usually because search results ate the
         * output budget).
         */
        const attempt = async (withSearch: boolean) => {
          sse(controller, { type: "phase", phase: withSearch ? "research" : "writing" });
          const tools: Anthropic.Messages.ToolUnion[] = [];
          if (withSearch) {
            tools.push({
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 4,
            } as Anthropic.Messages.ToolUnion);
          }
          tools.push({
            name: "submit_deck",
            description: "Submit the finished carousel deck. Call this exactly once, at the end.",
            input_schema: DECK_TOOL_SCHEMA,
          } as Anthropic.Messages.ToolUnion);

          const ms = client.messages.stream({
            model: MODEL,
            // Generous: a 12-slide deck plus search results overflows 8k, and
            // running out mid-tool-call loses the whole deck.
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
                if (b.name === "submit_deck") sse(controller, { type: "phase", phase: "writing" });
              }
            } else if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
              const p = partials.get(event.index);
              if (p) p.json += event.delta.partial_json;
            } else if (event.type === "content_block_stop") {
              const p = partials.get(event.index);
              if (p?.name === "web_search") {
                try {
                  const parsed = JSON.parse(p.json) as { query?: string };
                  if (parsed.query) sse(controller, { type: "search", query: parsed.query });
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
                  if (r.url) sse(controller, { type: "source", title: r.title ?? r.url, url: r.url });
                }
              }
            }
          }
          const call = final.content.find(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use" && b.name === "submit_deck",
          );
          return { call, stopReason: final.stop_reason };
        };

        let { call, stopReason } = await attempt(input.research);
        if (!call && input.research) {
          // Search ate the budget. Rather than dropping the user to the
          // skeleton, write it again from the model's own knowledge.
          sse(controller, {
            type: "notice",
            message: "Research ran long, so the deck was written without search.",
          });
          ({ call, stopReason } = await attempt(false));
        }

        if (!call) {
          finishOffline(
            `The model stopped before submitting a deck (${stopReason ?? "unknown"}), so this is the built-in draft skeleton. Try fewer slides.`,
          );
          return;
        }

        const parsed = deckSchema.safeParse({ ...(call.input as object), handle: input.handle });
        if (!parsed.success) {
          finishOffline(
            `The model's deck failed validation (${parsed.error.issues
              .slice(0, 2)
              .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
              .join("; ")}), so this is the draft skeleton instead.`,
          );
          return;
        }

        const { deck, issues } = normalizeDeck(parsed.data, {
          handle: input.handle ?? "",
          topic: input.topic,
        });
        sse(controller, { type: "deck", deck, issues });
        controller.close();
      } catch (err) {
        sse(controller, { type: "error", message: friendlyError(err, MODEL) });
        finishOffline(
          "So this is the built-in draft skeleton instead — the layouts are real, the words are placeholders you can edit.",
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
