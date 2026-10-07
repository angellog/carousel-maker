/**
 * The liveness endpoint, and the proof that the boot-time environment guard ran.
 *
 * `.railway/railway.ts` points the healthcheck here rather than at `/`. The homepage
 * renders fine on a wide-open deployment, so using it as the healthcheck proves
 * only that Node is listening. This route answers the question that actually
 * matters at deploy time: *did this process check its environment before it
 * started serving, and did the check pass?*
 *
 * In production, "the guard never ran" is itself a failure (503), not a shrug.
 * The guard lives in `instrumentation.ts`, which Next calls once per server
 * process; if its record is missing, something changed about how this process
 * boots and the fail-fast contract is no longer being enforced — exactly the
 * silent regression this whole change exists to prevent.
 *
 * **Nothing here echoes a value.** Only variable names, a pass/fail flag, and a
 * sentence about what breaks. Every name is already published in
 * `.env.production.example`, so an unauthenticated caller learns nothing it
 * could not read in the repo — and on a correctly configured production box the
 * only answer it ever gets is "ok".
 */

import { readEnvGuard } from "@/lib/env/boot";
import { checkProductionEnv, isProductionServer } from "@/lib/env/require";
import { assertLedgerWritable } from "@/lib/env/volume";

export const runtime = "nodejs";
// Never prerender this. A statically evaluated health route would freeze a 200
// into the build output and answer "healthy" from a file, for a process that
// may never have run the guard at all.
export const dynamic = "force-dynamic";

export async function GET() {
  const enforcing = isProductionServer(process.env);
  const guard = readEnvGuard();
  const report = checkProductionEnv(process.env);

  // Outside production the contract is informational: dev and CI are expected
  // to run without Flutterwave keys or a licence ledger, and failing the health
  // route there would make it useless as a local smoke test.
  //
  // The ledger probe runs per request rather than being cached from boot, and
  // that is the point: a volume can be remounted read-only, or fill up, long
  // after a process started cleanly. Boot proved the ledger was writable then;
  // this proves it is writable now, and turns the Railway healthcheck red if it
  // stops being — which is the only warning we would otherwise get before a
  // sale went unrecorded. It costs one `stat`-class syscall per healthcheck.
  const problems = enforcing
    ? [
        ...report.vars.filter((v) => !v.ok).map((v) => v.problem as string),
        ...report.checks.filter((c) => !c.ok).map((c) => c.problem as string),
        ...assertLedgerWritable(process.env),
      ]
    : [];

  if (enforcing && guard === undefined) {
    problems.unshift(
      "The startup environment guard did not run in this process. instrumentation.ts register() " +
        "is the only pre-request hook; if it did not execute, nothing is enforcing the production " +
        "environment contract.",
    );
  }

  const ok = problems.length === 0;

  return Response.json(
    {
      status: ok ? "ok" : "unhealthy",
      // `true` once the contract is being enforced — production serving only.
      // `false` in dev, in test, and during `next build`, all by design.
      enforcing,
      guard: guard
        ? { ran: true, enforced: guard.enforced, at: new Date(guard.at).toISOString() }
        : { ran: false },
      env: report.vars.map((v) => ({ name: v.name, ok: v.ok })),
      // Cross-variable invariants — currently "is the licence ledger on the
      // mounted volume", which is what holds this service to one replica.
      checks: report.checks.map((c) => ({ name: c.name, ok: c.ok })),
      problems,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
