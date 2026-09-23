// Owner-only Instagram auto-publish. Server-side only: it holds the Composio and
// Supabase service keys. It is inert unless IG_AUTOPUBLISH_HANDLE (or its
// NEXT_PUBLIC_ twin) and COMPOSIO_API_KEY are set, which the public deploy never does.
//
// Flow: JPEGs → public Supabase Storage URLs (Instagram only fetches by URL) →
// resolve the Composio connection that IS the expected handle → carousel
// container → publish → read back → delete the temporary images.

const COMPOSIO = process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev/api/v3";
const BUCKET = "ig-publish";

export const IG_MAX_SLIDES = 10;
const IG_MAX_CAPTION = 2200;
const IG_MAX_HASHTAGS = 30;

export interface PublishConfig {
  handle: string;
  composioKey: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export function publishConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PublishConfig | null {
  const handle = (env.IG_AUTOPUBLISH_HANDLE || env.NEXT_PUBLIC_IG_AUTOPUBLISH_HANDLE || "").replace(/^@/, "").trim();
  const composioKey = env.COMPOSIO_API_KEY || "";
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!handle || !composioKey || !supabaseUrl || !supabaseKey) return null;
  return { handle, composioKey, supabaseUrl, supabaseKey };
}

/**
 * Instagram's caption rules: 2,200 characters and at most 30 hashtags. Hashtags
 * beyond the cap are dropped rather than failing the whole post.
 */
export function buildCaption(caption: string, hashtags: string[]): string {
  const tags = hashtags
    .map((h) => `#${h.trim().replace(/^#+/, "")}`)
    .filter((h) => h.length > 1);
  const inBody = (caption.match(/#\w+/g) || []).length;
  const kept = tags.slice(0, Math.max(0, IG_MAX_HASHTAGS - inBody));
  const full = [caption.trim(), kept.join(" ")].filter(Boolean).join("\n\n");
  return full.length <= IG_MAX_CAPTION ? full : full.slice(0, IG_MAX_CAPTION - 1).trimEnd() + "…";
}

// ── Composio REST ────────────────────────────────────────────────────────────

interface Account {
  id: string;
  userId: string;
}

async function composio(cfg: PublishConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${COMPOSIO}${path}`, {
    ...init,
    headers: { "x-api-key": cfg.composioKey, "content-type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function exec(cfg: PublishConfig, account: Account, slug: string, args: Record<string, unknown>) {
  const { res, body } = await composio(cfg, `/tools/execute/${slug}`, {
    method: "POST",
    // Every REST call needs user_id next to connected_account_id (Composio error 1811).
    body: JSON.stringify({ user_id: account.userId, connected_account_id: account.id, arguments: args }),
  });
  if (!res.ok || body.successful === false) {
    const detail = typeof body.error === "string" ? body.error : JSON.stringify(body).slice(0, 400);
    const err = new Error(`${slug} failed: ${res.status} ${detail}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body.data as Record<string, unknown>;
}

/** Composio's REST and MCP catalogs name some tools differently; try each known name. */
async function execFirst(cfg: PublishConfig, account: Account, slugs: string[], args: Record<string, unknown>) {
  let last: unknown;
  for (const slug of slugs) {
    try {
      return await exec(cfg, account, slug, args);
    } catch (err) {
      last = err;
      if ((err as { status?: number }).status !== 404) throw err;
    }
  }
  throw last;
}

/**
 * Several Instagram accounts share this Composio workspace (shops, other brands).
 * Never trust a default: ask every active connection who it is and use only the
 * one whose username is the expected handle.
 */
async function resolveAccount(cfg: PublishConfig): Promise<{ account: Account; igUserId: string }> {
  const { res, body } = await composio(cfg, `/connected_accounts?toolkit_slugs=instagram&statuses=ACTIVE&limit=100`);
  if (!res.ok) throw new Error(`Could not list Composio connections: ${res.status}`);
  const items: Array<{ id: string; user_id: string }> = body.items || [];
  for (const item of items) {
    const account = { id: item.id, userId: item.user_id };
    try {
      const info = await exec(cfg, account, "INSTAGRAM_GET_USER_INFO", { ig_user_id: "me" });
      if (String(info.username).toLowerCase() === cfg.handle.toLowerCase()) {
        return { account, igUserId: String(info.id) };
      }
    } catch {
      // An expired connection just isn't a candidate.
    }
  }
  throw new Error(`No active Composio Instagram connection is @${cfg.handle}. Refusing to post.`);
}

// ── Supabase Storage (temporary public hosting) ──────────────────────────────

function storageHeaders(cfg: PublishConfig, extra: Record<string, string> = {}) {
  return { authorization: `Bearer ${cfg.supabaseKey}`, apikey: cfg.supabaseKey, ...extra };
}

async function ensureBucket(cfg: PublishConfig) {
  const res = await fetch(`${cfg.supabaseUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: storageHeaders(cfg, { "content-type": "application/json" }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, allowed_mime_types: ["image/jpeg"] }),
  });
  if (res.ok) return;
  const text = await res.text();
  if (!/already exists|Duplicate/i.test(text)) throw new Error(`Could not create storage bucket: ${res.status} ${text.slice(0, 200)}`);
}

async function uploadJpeg(cfg: PublishConfig, path: string, jpeg: Uint8Array): Promise<string> {
  const res = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: storageHeaders(cfg, { "content-type": "image/jpeg", "x-upsert": "true" }),
    body: jpeg as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Image upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return `${cfg.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function removeImages(cfg: PublishConfig, paths: string[]) {
  if (!paths.length) return;
  await fetch(`${cfg.supabaseUrl}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: storageHeaders(cfg, { "content-type": "application/json" }),
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => undefined);
}

// ── Publish ──────────────────────────────────────────────────────────────────

export interface PublishResult {
  handle: string;
  mediaId: string;
  permalink?: string;
}

export async function publishCarousel(
  cfg: PublishConfig,
  input: { jpegs: Uint8Array[]; caption: string },
): Promise<PublishResult> {
  const n = input.jpegs.length;
  if (n < 2 || n > IG_MAX_SLIDES) throw new Error(`Instagram carousels take 2–${IG_MAX_SLIDES} slides; this one has ${n}.`);

  // Identity first: nothing is uploaded unless the right account is connected.
  const { account, igUserId } = await resolveAccount(cfg);

  await ensureBucket(cfg);
  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const paths = input.jpegs.map((_, i) => `${run}/${String(i + 1).padStart(2, "0")}.jpg`);
  try {
    const urls = await Promise.all(input.jpegs.map((j, i) => uploadJpeg(cfg, paths[i], j)));

    const container = await exec(cfg, account, "INSTAGRAM_CREATE_CAROUSEL_CONTAINER", {
      ig_user_id: igUserId,
      child_image_urls: urls,
      caption: input.caption,
    });
    const creationId = String(container.id || container.creation_id || container.container_id || "");
    if (!creationId) throw new Error(`No carousel container id: ${JSON.stringify(container).slice(0, 200)}`);

    const media = await execFirst(cfg, account, ["INSTAGRAM_CREATE_POST", "INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH"], {
      ig_user_id: igUserId,
      creation_id: creationId,
    });
    const mediaId = String(media.id || media.media_id || creationId);

    // A returned id alone doesn't prove the post landed; read the newest one back.
    let permalink: string | undefined;
    try {
      const recent = await execFirst(cfg, account, ["INSTAGRAM_GET_USER_MEDIA", "INSTAGRAM_GET_IG_USER_MEDIA"], {
        ig_user_id: igUserId,
        limit: 1,
      });
      const list = (recent.data || recent.items || []) as Array<{ permalink?: string }>;
      permalink = list[0]?.permalink;
    } catch {
      // Published but unverifiable — still a success, just without a link.
    }
    return { handle: cfg.handle, mediaId, permalink };
  } finally {
    // Instagram copies the images while building the container, so the temporary
    // public copies can go whether publishing succeeded or not.
    await removeImages(cfg, paths);
  }
}
