/**
 * What this visitor is allowed to do — the truth the UI displays.
 *
 * The browser used to keep its own plan and count in `localStorage`, which
 * meant the numbers on screen were a guess and the cap was a suggestion. Now
 * the server answers, using the same counters `/api/generate` enforces, so
 * "1 left this week" is a fact.
 */

import { describe } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { state } = await describe(req.headers);
  return Response.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
