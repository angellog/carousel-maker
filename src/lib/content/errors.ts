/**
 * Trim and validate a key that arrived from the client. Returns undefined for
 * anything that is not plausibly an Anthropic key, so a stray value can never
 * be forwarded upstream or stored.
 */
export function sanitizeKey(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const key = raw.trim().replace(/^["']|["']$/g, "");
  if (!key.startsWith("sk-ant-")) return undefined;
  if (key.length < 40 || key.length > 400) return undefined;
  if (/\s/.test(key)) return undefined;
  return key;
}

/** Last four characters only — safe to show in a UI or a log line. */
export function maskKey(key: string): string {
  return `…${key.slice(-4)}`;
}

/**
 * Turn an SDK failure into something a person can act on. The raw API error is
 * a JSON blob; nobody testing on a phone should have to read it.
 */
export function friendlyError(err: unknown, model = "the configured model"): string {
  const raw = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  const lower = raw.toLowerCase();

  if (lower.includes("credit balance") || lower.includes("insufficient")) {
    return "The Anthropic API key has no credits left. Top it up at console.anthropic.com → Plans & Billing. (API credits are billed separately from a Claude subscription.)";
  }
  if (status === 401 || lower.includes("authentication") || lower.includes("invalid x-api-key")) {
    return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  }
  if (status === 403 || lower.includes("permission")) {
    return "That API key is not allowed to use this model. Check the key's permissions.";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "Rate limited by the API. Wait a moment and try again.";
  }
  if (status === 404 || lower.includes("not_found") || lower.includes("model not found")) {
    return `The model "${model}" was not found. Set CAROUSEL_MODEL in .env.local to a model your key can use.`;
  }
  if (typeof status === "number" && status >= 500) {
    return "The API is temporarily unavailable. Try again in a minute.";
  }
  if (lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnrefused")) {
    return "Could not reach the API — check your network connection.";
  }
  return raw;
}
