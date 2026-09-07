import type { GenerateInput } from "@/lib/content/prompt";
import {
  checkRateLimit,
  clientIdFromHeaders,
  envFromProcess,
  generateDeck,
  rateLimitConfigFromEnv,
  resolveConfig,
  type ProviderEvent,
} from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 300;

type Event = ProviderEvent | { type: "deck"; deck: unknown; issues?: unknown[] };

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

  const env = envFromProcess();
  const config = resolveConfig(input, env);

  // Spend protection: only the modes that cost *us* money are rate limited.
  // Bring-your-own-key and the keyless template writer are always free to run.
  if (config.writer.serverPaid) {
    const decision = checkRateLimit(clientIdFromHeaders(req.headers), rateLimitConfigFromEnv());
    if (!decision.ok) {
      return new Response(JSON.stringify({ error: decision.message, limit: decision.limit }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...(decision.retryAfter ? { "Retry-After": String(decision.retryAfter) } : {}),
        },
      });
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: ProviderEvent) => sse(controller, e);

      // Preserve the friendly keyless intro when there is no LLM at all.
      if (config.writer.kind === "template") {
        emit({
          type: "notice",
          message: input.research
            ? "No API key, so this deck was drafted from public sources — free, no key needed. Add a key under Options → API key for AI-written copy."
            : "No API key, so this is the built-in draft. Turn on research for free public-source facts, or add a key under Options → API key.",
        });
      }

      try {
        const { deck, issues } = await generateDeck({ input, env, emit });
        sse(controller, { type: "deck", deck, issues: issues as unknown[] | undefined });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
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
