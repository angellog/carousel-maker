/**
 * A record that the boot-time environment guard actually ran, readable from a
 * request handler.
 *
 * Why `globalThis` and not a module-level variable: `instrumentation.ts` and the
 * route handlers under `src/app` are not guaranteed to share a module registry.
 * Next bundles the instrumentation hook separately from the app router, so a
 * `let ran = false` in a shared module can — and in standalone output does —
 * resolve to two different instances, one per bundle. `/api/health` would then
 * report "the guard never ran" on a process where it ran and passed, which is
 * worse than no check: a healthcheck that fails when everything is fine gets
 * switched off. `globalThis` is the one thing that is unambiguously per-process.
 *
 * This is deliberately a *record*, not a cache of the verdict. `/api/health`
 * re-evaluates the contract against live `process.env` itself; this only answers
 * the separate question "did the startup assertion execute at all".
 */

const KEY = "__carouselMakerEnvGuard";

export interface EnvGuardRecord {
  /** Whether the contract was enforced (production) or skipped (dev, build). */
  enforced: boolean;
  /** How many problems the assertion found. Non-zero only if the exit failed. */
  problems: number;
  /** `Date.now()` when `register()` ran. */
  at: number;
}

type GuardHost = typeof globalThis & { [KEY]?: EnvGuardRecord };

/** Called once from `instrumentation.ts`. */
export function recordEnvGuard(record: Omit<EnvGuardRecord, "at">): void {
  (globalThis as GuardHost)[KEY] = { ...record, at: Date.now() };
}

/** `undefined` means `register()` never reached the guard in this process. */
export function readEnvGuard(): EnvGuardRecord | undefined {
  return (globalThis as GuardHost)[KEY];
}
