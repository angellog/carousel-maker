/**
 * A minimal fixed-window per-key limiter for cheap, abuse-prone endpoints
 * (e.g. the key-validation oracle). In-memory and per-instance — launch-grade
 * defense-in-depth, not a global budget. Move to the shared rate-limit store
 * (see providers/ratelimit `setRateLimitStore`) when the paid path does.
 */

const hits = new Map<string, number[]>();

/**
 * Returns true if this call is allowed (and records it), false if `key` has
 * already used its `limit` within the trailing `windowMs`.
 */
export function throttle(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so the map can't grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Test hook: clear all recorded hits. */
export function resetThrottle(): void {
  hits.clear();
}
