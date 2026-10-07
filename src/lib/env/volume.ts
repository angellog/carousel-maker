/**
 * The one boot check that has to touch the disk: can this process actually
 * write the licence ledger?
 *
 * `src/lib/env/require.ts` can prove that `CAROUSEL_LICENSE_LEDGER` points
 * inside the mounted volume. It cannot prove the process is allowed to write
 * there, and on this image that is the failure most likely to happen:
 *
 * - **Railway mounts volumes as `root`.** This Dockerfile's final stage runs
 *   `USER node` (uid 1000), so a volume at `/data` is root-owned and unwritable
 *   by the server unless `RAILWAY_RUN_UID=0` is set on the service. Railway
 *   documents exactly this: "Docker images that run as a non-root UID by default
 *   will have permissions issues when performing operations within an attached
 *   volume" (https://docs.railway.com/volumes/reference#caveats).
 * - **`FileLedger.record()` swallows write failures by design**, to keep serving
 *   when the disk misbehaves. Correct for an incident; catastrophic as the way
 *   you *discover* the ledger was never writable, because the discovery happens
 *   on a real sale, the licence is served from memory, and the only durable
 *   record of it is Flutterwave's.
 *
 * So the first $9 purchase is not an acceptable place to learn that the volume
 * is read-only. This probe moves that discovery to boot, where it is a crash
 * loop with a readable log and no money involved.
 *
 * Impure and deliberately separate from the contract module: the boot hook and
 * `/api/health` each call it explicitly, and tests drive it against real
 * temporary directories rather than a mocked file system.
 */

import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** The message for a failure, as `errno` strings an operator will recognise. */
function reason(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  return code ? `${code}` : "an unknown error";
}

/**
 * Problems with the configured ledger location, as full sentences. Empty array
 * means "this process can write its ledger", or that there is no file-backed
 * ledger to check.
 *
 * Creating the directory is intentional, not a side effect to apologise for:
 * `FileLedger.record()` already does `mkdirSync` on every write, so doing it
 * here changes nothing except *when* a permission problem surfaces — at deploy
 * time rather than at the moment a payment lands.
 */
export function assertLedgerWritable(env: Record<string, string | undefined>): string[] {
  const path = env.CAROUSEL_LICENSE_LEDGER?.trim();
  // No path means the in-memory ledger, which is a different problem and is
  // already refused by the production contract.
  if (!path) return [];

  const dir = dirname(path);

  try {
    mkdirSync(dir, { recursive: true });
  } catch (error) {
    return [
      `The licence ledger directory ${dir} cannot be created (${reason(error)}). ` +
        "CAROUSEL_LICENSE_LEDGER has to be a path this process can write: on Railway that means " +
        "inside the attached volume's mount path, and with RAILWAY_RUN_UID=0 set on the service, " +
        "because this image runs as the unprivileged `node` user and Railway mounts volumes as root. " +
        "Until it is writable, every issued licence exists only in this process's memory — it is " +
        "gone on the next deploy, and nothing stops a webhook retry issuing it twice.",
    ];
  }

  // Check the file itself when it exists: a ledger file can be unwritable
  // inside a perfectly writable directory, and that is the state in which we
  // would keep selling while recording nothing.
  const target = existsSync(path) ? path : dir;

  try {
    accessSync(target, constants.W_OK);
  } catch (error) {
    return [
      `The licence ledger at ${path} is not writable by this process (${reason(error)} on ${target}). ` +
        "This image runs as the unprivileged `node` user and Railway mounts volumes as root, so an " +
        "attached volume needs RAILWAY_RUN_UID=0 set on the service. Without it, FileLedger silently " +
        "swallows every append: licences are served from memory, lost on the next deploy, and a " +
        "Flutterwave retry mints a second licence for a payment already fulfilled.",
    ];
  }

  return [];
}
