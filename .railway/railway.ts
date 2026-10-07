/**
 * The Railway side of this deployment, in version control.
 *
 * ## Why this file exists and `railway.toml` does not
 *
 * This service must run on **exactly one replica**, and that fact has to live
 * somewhere a reviewer can see. It used to live in a comment at the top of
 * `railway.toml` — which is to say nowhere, because Railway does not read
 * comments and, as of Railway's 2026 change, will not read that file at all:
 *
 * - Config as Code (`railway.json` / `railway.toml`) is **deprecated**. Files
 *   that already belong to a legacy service keep working until the hard cutoff
 *   on **2026-12-01**, and **new services cannot opt into it**.
 * - The Carousel Maker service does not exist on Railway yet, so it will be a
 *   new service. A `railway.toml` in this repo would never have been read —
 *   not the replica count, not `healthcheckPath`, not the restart policy.
 *
 * Infrastructure as Code (this file) is the replacement, and it is the one
 * mechanism that actually applies. See https://docs.railway.com/infrastructure-as-code.
 *
 * ## This file is not read during a deploy
 *
 * Railway never reads `.railway/` when it builds or deploys. A human or CI
 * applies it with the CLI:
 *
 *     npm install                     # the `railway` devDependency evaluates this file
 *     railway link                    # pick the project + environment once
 *     railway config plan             # show the diff, change nothing
 *     railway config apply            # apply after confirming the diff
 *
 * So this is a *reviewable desired state* plus a one-command way to enforce it,
 * not an automatic guard. The automatic guard is at boot: see
 * `src/lib/env/require.ts` and `src/lib/env/volume.ts`, which refuse to serve a
 * production process whose licence ledger is not on a mounted, writable volume.
 *
 * ## Variables are deliberately absent
 *
 * Every secret this service needs is set on the Railway service itself (see
 * DEPLOY.md steps 4–7 and `.env.production.example`). They are not declared
 * here, and `env` is left out entirely rather than listed partially: an `env`
 * block is a statement about the whole set, so declaring two variables invites
 * an apply that proposes deleting the other eight. If you add one, add all of
 * them with `preserve()` and read the plan before applying it.
 *
 * `RAILWAY_RUN_UID=0` is the one variable you cannot skip and cannot infer —
 * it is in the DEPLOY.md list, and a boot that lacks it fails the volume probe
 * loudly rather than losing the first sale quietly.
 */

import { defineRailway, github, project, service, volume } from "railway/iac";

export default defineRailway(() => {
  /**
   * The licence ledger lives here, and it is the reason this service cannot be
   * scaled. `CAROUSEL_LICENSE_LEDGER` must point inside the mount path below;
   * `checkProductionEnv` refuses to boot if it does not.
   *
   * No `region` or `sizeMB`: Railway's defaults are fine, and pinning either
   * one here would plan a destructive move against a volume created in the
   * dashboard with different settings.
   */
  const data = volume("carousel-data");

  const web = service("carousel-maker", {
    source: github("angellog/carousel-maker", { branch: "main" }),

    /**
     * **One replica. Not a preference — multi-replica is currently incorrect.**
     *
     * `FileLedger` (src/lib/access/ledger.ts) loads the licence ledger into
     * memory at boot and appends to a JSON-lines file on this volume. Two
     * replicas means two ledgers:
     *
     * - `issued()` diverges, so the founding-seat counter is fiction and two
     *   buyers can be sold the same seat number.
     * - `findByTx()` is per process, so a Flutterwave webhook retry that lands
     *   on the other replica mints a second licence for one $9 payment.
     *
     * The in-memory spend limiter (`MemoryRateLimitStore`) has the same shape
     * but a smaller blast radius: a per-replica limiter raises the free-tier
     * ceiling, which costs money. The ledger breaks money *correctness*. That
     * is why swapping in a shared rate-limit store on its own would be worse
     * than doing nothing: it makes multi-replica look safe while the ledger
     * silently double-issues.
     *
     * Railway also refuses replicas on a service with a volume attached
     * ("Replicas cannot be used with volumes" —
     * https://docs.railway.com/volumes/reference#caveats), so the volume below
     * is the hard pin and this line is the declared intent. Both are here on
     * purpose: if the ledger ever moves off the volume, the platform's pin
     * disappears and only this line and the boot check remain.
     *
     * Lifting this needs both changes shipped together — Postgres ledger *and*
     * a shared store through `setRateLimitStore`. DEPLOY.md states the exit
     * criteria.
     */
    replicas: 1,

    /**
     * `/api/health`, not `/`. The homepage renders perfectly well on a
     * deployment with no bot shield and no weekly cap, so `/` proves only that
     * Node is listening. `/api/health` reports whether the boot-time contract
     * ran and passed, so a green healthcheck means the contract is enforced on
     * the process that is serving.
     */
    healthcheck: "/api/health",
    healthcheckTimeout: 120,

    volumeMounts: {
      // Must match the directory in `CAROUSEL_LICENSE_LEDGER`.
      "/data": data,
    },

    deploy: {
      // A misconfigured production boot calls process.exit(1) from the
      // instrumentation hook, before a single request is served. ON_FAILURE
      // turns that into a crash loop with every problem named in the deploy log
      // — loud and fixable — instead of a deploy that reports healthy while it
      // is wide open.
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
    },
  });

  return project("carousel-maker", {
    resources: [web, data],
  });
});
