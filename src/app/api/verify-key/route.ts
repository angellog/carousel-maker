import Anthropic from "@anthropic-ai/sdk";
import { friendlyError, maskKey, sanitizeKey } from "@/lib/content/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.CAROUSEL_MODEL || "claude-sonnet-5";

/**
 * Check a key with the smallest possible real call, and say plainly what is
 * wrong when it fails — no credits, rejected, rate limited, wrong model.
 *
 * The key is used for this one request and discarded. It is never written to
 * disk, never logged, and only the last four characters are echoed back.
 */
export async function POST(req: Request) {
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
