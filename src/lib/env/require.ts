/**
 * The production environment contract, in one place, asserted at boot.
 *
 * Several of this app's switches are *fail-open by default* — and that default
 * is correct for local dev and for a self-host that opts out. `TURNSTILE_SECRET`
 * unset means "no bot shield"; `CAROUSEL_RATE_PER_WEEK` unset means "no weekly
 * cap". Each one is a deliberate, documented choice. The danger is that the same
 * choice applied to our own public deployment produces a service that looks
 * healthy and is wide open: the free tier is unlimited, the paid path is
 * unshielded, and nothing anywhere says so.
 *
 * A launch checklist is a human remembering. This is the machine remembering:
 * in production every switch below must be set *explicitly*, and the process
 * refuses to serve a single request until they are. See `src/instrumentation.ts`
 * for the boot-time call and `/api/health` for the runtime report.
 *
 * Two kinds of requirement live here. `PRODUCTION_ENV_CONTRACT` is per-variable:
 * each entry judges one name on its own. `PRODUCTION_ENV_INVARIANTS` is for the
 * things no single variable can express — "the licence ledger is on the mounted
 * volume" is a fact about three variables at once, and it is the one that keeps
 * this service on a single replica.
 *
 * Everything here is pure — no `process.env` reads, no file system, no logging,
 * no exits — so it can be exercised against a fabricated environment without
 * booting a server. The one check that *must* touch the disk lives next door in
 * `./volume.ts` and is called separately by the boot hook and `/api/health`.
 */

/** How a variable must be configured in production. */
export type EnvRule =
  /** Must be present and non-blank (and pass `check`, when given). */
  | "required"
  /** Must not be set at all. */
  | "forbidden"
  /** May be absent — but if it is set, it must pass `check`. */
  | "optional";

export interface EnvRequirement {
  name: string;
  rule: EnvRule;
  /** What silently breaks when the requirement isn't met. Goes in the message. */
  breaks: string;
  /**
   * Extra validation for a value that *is* present. Returns a reason when the
   * value is unusable, `undefined` when it's fine. Presence alone is not always
   * enough: a non-numeric `CAROUSEL_RATE_PER_WEEK` is silently discarded by
   * `rateLimitConfigFromEnv` and falls back to the same `Infinity` as unset, so
   * "set, but to junk" is exactly as fail-open as "not set".
   */
  check?: (value: string) => string | undefined;
}

/**
 * A count ceiling, parsed the way `rateLimitConfigFromEnv` parses it: anything
 * that isn't a finite number >= 0 is thrown away in favour of the default. We
 * reject here precisely what that function would ignore there.
 */
function countCeiling(value: string): string | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return "must be a whole number >= 0 (anything else is silently ignored and the default applies)";
  }
  if (!Number.isInteger(n)) return "must be a whole number, not a fraction";
  return undefined;
}

/**
 * A kill switch that must be off. Present-but-off is fine — an operator writing
 * `CAROUSEL_RATE_DISABLED=0` is explicitly saying "limiter on", which is what we
 * want. Only the truthy spellings the reading code honours are refused.
 */
function mustNotBeEnabled(value: string): string | undefined {
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true") {
    return "is a kill switch and must not be enabled in production (unset it, or set it to 0)";
  }
  return undefined;
}

/**
 * Every environment switch that changes how safe this deployment is. Ordered by
 * what it costs us when it's wrong: money first, then the ability to sell, then
 * correctness of what we've already sold.
 */
export const PRODUCTION_ENV_CONTRACT: readonly EnvRequirement[] = [
  {
    name: "CAROUSEL_RATE_PER_WEEK",
    rule: "required",
    breaks: "the weekly free-tier cap does not exist — unset means Infinity, so the free tier is unlimited and the Maker licence has nothing to sell",
    check: countCeiling,
  },
  {
    // Not in the audited list, but the same bug with a bigger blast radius:
    // unset is already the safe state (limiter on), so this is `optional` — we
    // only refuse the one spelling that turns the limiter off.
    name: "CAROUSEL_RATE_DISABLED",
    rule: "optional",
    breaks: "spend protection is switched off entirely — every per-client ceiling and the global daily budget stop counting",
    check: mustNotBeEnabled,
  },
  {
    name: "CAROUSEL_DAILY_BUDGET",
    rule: "required",
    breaks: "the hard ceiling on total paid generations per day is whatever the default happens to be, not a number anyone chose",
    check: countCeiling,
  },
  {
    name: "TURNSTILE_SECRET",
    rule: "required",
    breaks: "there is no bot shield on /api/generate — verifyTurnstile returns ok for every caller, on the one path that spends our money",
  },
  {
    name: "CAROUSEL_LICENSE_SECRET",
    rule: "required",
    breaks: "no licence can be signed or verified, so nobody can buy and nobody who has bought can unlock",
  },
  {
    name: "CAROUSEL_LICENSE_LEDGER",
    rule: "required",
    breaks: "issued licences are recorded in memory only — the founding-seat counter resets on every deploy, seat numbers repeat, and webhook idempotency is lost, which mints duplicate licences for one payment",
  },
  {
    name: "FLW_PUBLIC_KEY",
    rule: "required",
    breaks: "flutterwaveConfigFromEnv returns nothing, so checkout and payment verification are both dead and no licence can be sold",
  },
  {
    name: "FLW_SECRET_KEY",
    rule: "required",
    breaks: "a payment can never be verified server-to-server, and a redirect is not a payment",
  },
  {
    name: "FLW_SECRET_HASH",
    rule: "required",
    breaks: "the billing webhook cannot authenticate its caller — an unsigned webhook endpoint is a licence printer for anyone who finds the URL",
  },
  {
    name: "CAROUSEL_LICENSE_DEV_UNLOCK",
    rule: "forbidden",
    breaks: "it mints licences with no payment at all",
  },
];

export interface EnvVarResult {
  name: string;
  ok: boolean;
  /** The problem, when `ok` is false. Names the variable; never its value. */
  problem?: string;
}

export interface EnvCheckResult {
  /** Stable kebab-case id of the invariant, for `/api/health` to list. */
  name: string;
  ok: boolean;
  /** The problem, when `ok` is false. */
  problem?: string;
}

export interface EnvReport {
  ok: boolean;
  /** One entry per contract variable, in contract order. */
  vars: readonly EnvVarResult[];
  /** One entry per cross-variable invariant, in declaration order. */
  checks: readonly EnvCheckResult[];
}

/** Treat blank and whitespace-only as absent — every reader here trims first. */
function present(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const t = value.trim();
  return t ? t : undefined;
}

function evaluate(req: EnvRequirement, raw: string | undefined): EnvVarResult {
  const value = present(raw);

  if (req.rule === "forbidden") {
    return value === undefined
      ? { name: req.name, ok: true }
      : { name: req.name, ok: false, problem: `${req.name} must not be set in production: ${req.breaks}.` };
  }

  if (value === undefined) {
    return req.rule === "optional"
      ? { name: req.name, ok: true }
      : { name: req.name, ok: false, problem: `${req.name} is not set. Without it, ${req.breaks}.` };
  }

  const reason = req.check?.(value);
  return reason === undefined
    ? { name: req.name, ok: true }
    : { name: req.name, ok: false, problem: `${req.name} ${reason}. Without a usable value, ${req.breaks}.` };
}

/**
 * An invariant that spans more than one variable, so no `EnvRequirement` can
 * express it. Returns the problem, or `undefined` when the invariant holds —
 * *or* when this environment cannot be judged at all (see `RAILWAY_SERVICE_ID`
 * below). The difference between "holds" and "not applicable" is deliberately
 * invisible to callers: both mean "nothing to refuse a boot over".
 */
export interface EnvInvariant {
  /** Stable kebab-case id. Appears in `/api/health`. */
  name: string;
  check: (env: Record<string, string | undefined>) => string | undefined;
}

/** Whether this process is running on Railway at all. */
function onRailway(env: Record<string, string | undefined>): boolean {
  // RAILWAY_SERVICE_ID is injected into every Railway build and deployment and
  // exists nowhere else, so it is the cheapest honest "am I on Railway" signal.
  // The self-host path (docker compose on a VPS, DEPLOY.md §2) has no volume
  // mount variables at all, and guessing at its disk layout would turn a
  // correct deployment into a crash loop.
  return present(env.RAILWAY_SERVICE_ID) !== undefined;
}

/**
 * Whether `child` is the same path as `parent` or sits underneath it.
 *
 * Plain string comparison on purpose: this module stays dependency-free so it
 * can be imported from anywhere, including bundles with no `node:path`. Any
 * path containing a `..` segment is rejected rather than resolved — a ledger
 * path written as `/data/../tmp/licences.jsonl` is not something to normalise
 * and accept, it is something to refuse.
 */
function isWithin(child: string, parent: string): boolean {
  if (!child.startsWith("/") || !parent.startsWith("/")) return false;
  const segments = (p: string) => p.split("/").filter((s) => s.length > 0);
  const c = segments(child);
  const p = segments(parent);
  if (c.includes("..") || p.includes("..")) return false;
  if (c.length < p.length) return false;
  return p.every((segment, i) => c[i] === segment);
}

/**
 * The invariants that keep this service on one replica.
 *
 * **There is no replica-count check here, because Railway does not expose one.**
 * The injected variables are `RAILWAY_REPLICA_ID` and `RAILWAY_REPLICA_REGION`
 * (https://docs.railway.com/variables/reference) — they identify *which*
 * replica this process is, never how many exist. A process on replica 3 of 5
 * and a process on the only replica see environments that are indistinguishable
 * from inside the container. So rather than write a check that always passes
 * and pretend the question is answered, this names what is actually enforceable:
 *
 *  1. **The ledger is on a mounted volume** — below. Railway refuses replicas on
 *     a service that has a volume attached ("Replicas cannot be used with
 *     volumes", https://docs.railway.com/volumes/reference#caveats), so a
 *     correctly mounted ledger *is* the replica pin, enforced by the platform
 *     rather than asserted by us. It is also the only configuration in which the
 *     ledger survives a deploy.
 *  2. **The ledger is writable** — `./volume.ts`, which needs the disk and so
 *     cannot live in this pure module.
 *
 * Together those cover the failure this service actually has. The day the ledger
 * moves to Postgres, (1) stops being the replica pin and a real replica check
 * becomes necessary — by which time, per DEPLOY.md's exit criteria, a shared
 * rate-limit store ships in the same change and multiple replicas become correct.
 */
export const PRODUCTION_ENV_INVARIANTS: readonly EnvInvariant[] = [
  {
    name: "ledger-on-mounted-volume",
    check: (env) => {
      const ledger = present(env.CAROUSEL_LICENSE_LEDGER);
      // Absent is already reported by the `required` rule above; saying it twice
      // just makes the deploy log longer.
      if (ledger === undefined) return undefined;
      if (!onRailway(env)) return undefined;

      // Set by Railway on any service with a volume attached, and only then.
      const mount = present(env.RAILWAY_VOLUME_MOUNT_PATH);
      if (mount === undefined) {
        return (
          "CAROUSEL_LICENSE_LEDGER points at a file on this container's own disk: " +
          "RAILWAY_VOLUME_MOUNT_PATH is unset, so no volume is attached to this service. " +
          "Every deploy would start the licence ledger from zero — the founding-seat counter " +
          "resets, seat numbers repeat, and a webhook retry mints a second licence for a " +
          "payment already fulfilled. Attach a volume (Settings → Volumes) and point " +
          "CAROUSEL_LICENSE_LEDGER inside its mount path. An attached volume is also what " +
          "holds this service to one replica: Railway refuses replicas on a service with a " +
          "volume, and two replicas means two divergent ledgers."
        );
      }

      if (!isWithin(ledger, mount)) {
        return (
          "CAROUSEL_LICENSE_LEDGER is not inside the mounted volume. The volume is mounted at " +
          `${mount} (RAILWAY_VOLUME_MOUNT_PATH), and the ledger path is somewhere else, which ` +
          "means it is on the container filesystem and is discarded on every deploy — losing " +
          "the seat counter and the webhook idempotency that stops one $9 payment minting two " +
          `licences. Set CAROUSEL_LICENSE_LEDGER to a path under ${mount}.`
        );
      }

      return undefined;
    },
  },
];

/**
 * Check `env` against the production contract. Pure. Reports every variable and
 * every invariant, passing and failing, so `/api/health` can show the whole
 * contract rather than only what broke.
 */
export function checkProductionEnv(env: Record<string, string | undefined>): EnvReport {
  const vars = PRODUCTION_ENV_CONTRACT.map((req) => evaluate(req, env[req.name]));
  const checks = PRODUCTION_ENV_INVARIANTS.map((inv) => {
    const problem = inv.check(env);
    return problem === undefined ? { name: inv.name, ok: true } : { name: inv.name, ok: false, problem };
  });
  return { ok: vars.every((v) => v.ok) && checks.every((c) => c.ok), vars, checks };
}

/**
 * Every reason this environment is not fit to serve production, one string per
 * problem, each naming the variable it is about. Empty array = fit to serve.
 *
 * This deliberately reports *all* problems rather than the first: an operator
 * fixing a misconfigured deploy should need one restart, not seven.
 *
 * Variables first, then invariants: a missing `CAROUSEL_LICENSE_LEDGER` should
 * be read before a sentence about where that variable ought to point.
 */
export function assertProductionEnv(env: Record<string, string | undefined>): string[] {
  const report = checkProductionEnv(env);
  return [
    ...report.vars.filter((v) => !v.ok).map((v) => v.problem as string),
    ...report.checks.filter((c) => !c.ok).map((c) => c.problem as string),
  ];
}

/**
 * Whether this process must satisfy the contract: a production *server*, running
 * on Node, actually about to handle requests.
 *
 * Three conditions, and the two beyond `NODE_ENV` matter as much as it does.
 *
 * - **`next build` also runs with `NODE_ENV=production`**, and it loads
 *   `instrumentation.ts` in its worker processes. A NODE_ENV-only guard would
 *   assert build-time env against a runtime contract and fail the Docker build —
 *   the exact trap that keeps this check out of `next.config.ts`. Next sets
 *   `NEXT_PHASE` to `phase-production-build` for the duration of a build; a
 *   serving process never carries that value.
 * - **The build emits an edge copy of this hook** (`.next/server/
 *   edge-instrumentation.js`) whether or not anything uses the edge runtime
 *   today. Nothing executes it while every route is `runtime = "nodejs"` and
 *   there is no `middleware.ts` — but adding either would start running this
 *   contract in a V8 isolate that has no `process.exit` and only a partial view
 *   of the service's environment. It would then report missing variables that
 *   are present, and fail trying to exit. Next sets `NEXT_RUNTIME` per bundle;
 *   undefined means a plain Node process (the test suite, a script).
 *
 * The Node server process remains the one place the contract is enforced, which
 * is what `/api/health` reports and what the Railway healthcheck verifies.
 */
export function isProductionServer(env: Record<string, string | undefined>): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (env.NEXT_RUNTIME !== undefined && env.NEXT_RUNTIME !== "nodejs") return false;
  const phase = env.NEXT_PHASE;
  return phase !== "phase-production-build" && phase !== "phase-export";
}
