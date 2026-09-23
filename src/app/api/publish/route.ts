import { buildCaption, IG_MAX_SLIDES, publishCarousel, publishConfigFromEnv } from "@/lib/publish/instagram";

export const runtime = "nodejs";
export const maxDuration = 300;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * Owner-only: posts a finished carousel to the configured Instagram account.
 * Returns 404 unless publishing is configured, so the public deploy exposes
 * nothing. In production it also requires IG_PUBLISH_TOKEN.
 */
export async function POST(req: Request) {
  const cfg = publishConfigFromEnv();
  if (!cfg) return json({ error: "Not found" }, 404);

  const token = process.env.IG_PUBLISH_TOKEN;
  if (token ? req.headers.get("x-publish-token") !== token : process.env.NODE_ENV === "production") {
    return json({ error: "Unauthorized" }, 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Expected multipart form data" }, 400);
  }
  const files = form.getAll("slides").filter((f): f is File => f instanceof File);
  if (files.length < 2 || files.length > IG_MAX_SLIDES) {
    return json({ error: `Instagram carousels take 2–${IG_MAX_SLIDES} slides; got ${files.length}.` }, 400);
  }
  if (files.some((f) => f.type !== "image/jpeg")) return json({ error: "Slides must be JPEG" }, 400);

  const hashtags = String(form.get("hashtags") || "").split(/\s+/).filter(Boolean);
  const caption = buildCaption(String(form.get("caption") || ""), hashtags);

  try {
    const jpegs = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
    const result = await publishCarousel(cfg, { jpegs, caption });
    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Publish failed" }, 502);
  }
}
