/**
 * The one hook that runs before this server handles a request.
 *
 * `register()` is called once per server process, at startup, in both the dev
 * server and the standalone production bundle. That makes it the only place a
 * "refuse to serve a misconfigured production deployment" check can live and
 * actually mean it. Not `next.config.ts`: that is evaluated at build time, where
 * the runtime environment does not exist yet and a throw breaks `next build`.
 * Not middleware or a route: by then we have already served something.
 *
 * On a misconfigured production boot this prints every problem and exits 1.
 * Railway's `restartPolicyType = "ON_FAILURE"` turns that into a crash loop with
 * a readable log — loud, diagnosable, and serving nothing — instead of a deploy
 * that reports green while the weekly cap and the bot shield are both off.
 *
 * See src/lib/env/require.ts for the contract and /api/health for the runtime
 * report.
 */

import { recordEnvGuard } from "./lib/env/boot";
import { assertProductionEnv, isProductionServer } from "./lib/env/require";

export async function register(): Promise<void> {
  // Dev, test and `next build` are untouched: the contract describes what our
  // own public deployment needs, not what the app needs in order to run.
  if (!isProductionServer(process.env)) {
    recordEnvGuard({ enforced: false, problems: 0 });
    return;
  }

  const problems = assertProductionEnv(process.env);
  recordEnvGuard({ enforced: true, problems: problems.length });
  if (problems.length === 0) return;

  // One problem per line, each naming its variable. Railway's log viewer wraps
  // long lines badly, so the variable name leads every line.
  console.error("");
  console.error("REFUSING TO START — this production environment is not safe to serve.");
  console.error("");
  for (const problem of problems) {
    console.error(`  ✗ ${problem}`);
  }
  console.error("");
  console.error(
    // "Fix", not "set": two of these variables are faults of *presence*, and
    // telling an operator to set CAROUSEL_LICENSE_DEV_UNLOCK is the opposite of
    // the instruction they need.
    `${problems.length} problem${problems.length === 1 ? "" : "s"}. ` +
      "Fix each one in the service's environment (see .env.production.example), then redeploy.",
  );
  console.error("");

  process.exit(1);
}
