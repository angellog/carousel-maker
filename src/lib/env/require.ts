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
 * Everything here is pure — no `process.env` reads, no logging, no exits — so it
 * can be exercised against a fabricated environment without booting a server.
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

export interface EnvReport {
  ok: boolean;
  /** One entry per contract variable, in contract order. */
  vars: readonly EnvVarResult[];
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
 * Check `env` against the production contract. Pure. Reports every variable,
 * passing and failing, so `/api/health` can show the whole contract rather than
 * only what broke.
 */
export function checkProductionEnv(env: Record<string, string | undefined>): EnvReport {
  const vars = PRODUCTION_ENV_CONTRACT.map((req) => evaluate(req, env[req.name]));
  return { ok: vars.every((v) => v.ok), vars };
}

/**
 * Every reason this environment is not fit to serve production, one string per
 * problem, each naming the variable it is about. Empty array = fit to serve.
 *
 * This deliberately reports *all* problems rather than the first: an operator
 * fixing a misconfigured deploy should need one restart, not seven.
 */
export function assertProductionEnv(env: Record<string, string | undefined>): string[] {
  return checkProductionEnv(env)
    .vars.filter((v) => !v.ok)
    .map((v) => v.problem as string);
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
