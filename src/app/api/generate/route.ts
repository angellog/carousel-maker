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
import { turnstileSecretFromEnv, verifyTurnstile } from "@/lib/turnstile";
import { authorize, describe } from "@/lib/access";

export const runtime = "nodejs";
export const maxDuration = 300;

type Event = ProviderEvent | { type: "deck"; deck: unknown; issues?: unknown[]; access?: unknown };

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

  // The licence cap, enforced here because this is the only place it can be
  // true. A slot is claimed before any work starts and rolled back if the run
  // never gets going, so a failed generation is never charged to anyone.
  const access = await authorize({
    headers: req.headers,
    apiKey: input.apiKey,
    serverPaid: config.writer.serverPaid,
  });
  if (!access.ok) {
    return new Response(
      JSON.stringify({
        error: access.message,
        reason: access.reason,
        state: access.state,
        ...(access.retryAfter ? { retryAfter: access.retryAfter } : {}),
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          ...(access.retryAfter ? { "Retry-After": String(access.retryAfter) } : {}),
        },
      },
    );
  }
  const releaseSlot = access.rollback;

  // The paid path (our embedded key) is bot-shielded and rate limited. The
  // free paths (bring-your-own-key, keyless template writer) skip both, since
  // they spend the user's money or nobody's.
  if (config.writer.serverPaid) {
    // 1. Turnstile — stop bots before they can claim a rate-limit slot.
    const verdict = await verifyTurnstile(
      req.headers.get("cf-turnstile-response"),
      turnstileSecretFromEnv(),
      clientIdFromHeaders(req.headers),
    );
    if (!verdict.ok) {
      releaseSlot();
      return new Response(
        JSON.stringify({ error: "Please complete the verification and try again." }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Spend protection.
    const decision = checkRateLimit(clientIdFromHeaders(req.headers), rateLimitConfigFromEnv());
    if (!decision.ok) {
      releaseSlot();
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
        const { deck, issues, config: used } = await generateDeck({ input, env, emit });

        // The writer we asked for failed and the orchestrator handed back a
        // placeholder skeleton. That is not the carousel anyone came for, so
        // it must not cost a slot: give it back before reporting the count.
        if (deck.offline && used.writer.kind !== "template") releaseSlot();
        // Recomputed after the slot was claimed, so the counter the browser
        // shows is the counter the server will enforce on the next run.
        const { state } = await describe(req.headers, { apiKey: input.apiKey });
        sse(controller, {
          type: "deck",
          deck,
          issues: issues as unknown[] | undefined,
          access: state,
        });
      } catch (err) {
        // The run never produced a deck, so give the slot back.
        releaseSlot();
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
