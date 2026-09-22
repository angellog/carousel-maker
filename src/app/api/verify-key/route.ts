import Anthropic from "@anthropic-ai/sdk";
import { friendlyError, maskKey, sanitizeKey } from "@/lib/content/errors";
import { clientIdFromHeaders } from "@/lib/providers/ratelimit";
import { throttle } from "@/lib/security/throttle";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CAROUSEL_MODEL || "claude-sonnet-5";

/** Cap the request body so this endpoint can't be used to ship large payloads. */
const MAX_BODY_BYTES = 4_096;
/** Per-IP attempts: this route makes a live upstream call, so throttle hard to
 *  stop it being used as a bulk key-validation oracle. */
const VERIFY_PER_MINUTE = 8;

/**
 * Check a key with the smallest possible real call, and say plainly what is
 * wrong when it fails — no credits, rejected, rate limited, wrong model.
 *
 * The key is used for this one request and discarded. It is never written to
 * disk, never logged, and only the last four characters are echoed back.
 */
export async function POST(req: Request) {
  // Per-IP throttle before doing any upstream work.
  if (!throttle(`verify-key:${clientIdFromHeaders(req.headers)}`, VERIFY_PER_MINUTE, 60_000)) {
    return Response.json(
      { ok: false, message: "Too many attempts. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ ok: false, message: "Request too large." }, { status: 413 });
  }

  let body: { apiKey?: string };
  try {
    body = (await req.json()) as { apiKey?: string };
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const key = sanitizeKey(body.apiKey);
  if (!key) {
    return Response.json({
      ok: false,
      message: "That doesn't look like an Anthropic key — they start with sk-ant-.",
    });
  }

  try {
    const client = new Anthropic({ apiKey: key });
    await client.messages.create({
      model: MODEL,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    });
    return Response.json({
      ok: true,
      message: `Key ${maskKey(key)} works with ${MODEL}.`,
      masked: maskKey(key),
    });
  } catch (err) {
    return Response.json({ ok: false, message: friendlyError(err, MODEL) });
  }
}
