/**
 * The checks that keep this service on exactly one replica.
 *
 * Multi-replica is not a trade-off here, it is a correctness bug: `FileLedger`
 * holds the licence ledger in memory and appends to one file, so N replicas is
 * N divergent seat counters and N independent idempotency caches — two buyers
 * sold the same founding seat, and one $9 webhook retry minting a second
 * licence. Railway exposes no replica count, so what is actually enforced is
 * the thing that *implies* one replica: the ledger lives on an attached volume,
 * and Railway refuses replicas on a service with a volume.
 *
 * Two things are tested, and the second is the one that matters:
 *
 *   1. That the invariant and the probe report the right thing.
 *   2. That each one actually fails when the deployment is broken in the
 *      specific way it exists to catch. A guard that only ever passes is
 *      indistinguishable from no guard, and this whole file would then be
 *      decoration on top of a licence ledger quietly double-issuing.
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRailwayContext, project } from "railway/iac";
import { afterEach, describe, expect, it } from "vitest";
import railwayProgram from "../.railway/railway";
import {
  PRODUCTION_ENV_INVARIANTS,
  assertProductionEnv,
  checkProductionEnv,
} from "@/lib/env/require";
import { assertLedgerWritable } from "@/lib/env/volume";

/** A production environment that satisfies the per-variable contract. */
function completeEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    CAROUSEL_RATE_PER_WEEK: "2",
    CAROUSEL_DAILY_BUDGET: "500",
    TURNSTILE_SECRET: "0x-turnstile-secret",
    CAROUSEL_LICENSE_SECRET: "a-long-random-licence-signing-secret",
    CAROUSEL_LICENSE_LEDGER: "/data/licences.jsonl",
    FLW_PUBLIC_KEY: "FLWPUBK-fake",
    FLW_SECRET_KEY: "FLWSECK-fake",
    FLW_SECRET_HASH: "fake-webhook-hash",
  };
}

/** The same, as Railway would present it: on Railway, with a volume at /data. */
function railwayEnv(): Record<string, string | undefined> {
  return {
    ...completeEnv(),
    RAILWAY_SERVICE_ID: "svc_fake",
    RAILWAY_REPLICA_ID: "replica_fake",
    RAILWAY_VOLUME_NAME: "carousel-data",
    RAILWAY_VOLUME_MOUNT_PATH: "/data",
  };
}

const invariantNames = PRODUCTION_ENV_INVARIANTS.map((i) => i.name);

describe("the ledger-on-mounted-volume invariant", () => {
  it("is part of the contract under a stable name, so /api/health can report it", () => {
    // A named list rather than a count: a count is satisfied by any one check,
    // which is how a guard gets quietly swapped for a weaker one.
    expect(invariantNames).toEqual(["ledger-on-mounted-volume"]);
    expect(checkProductionEnv(railwayEnv()).checks.map((c) => c.name)).toEqual(invariantNames);
  });

  it("passes a Railway deployment whose ledger is on the volume", () => {
    expect(assertProductionEnv(railwayEnv())).toEqual([]);
  });

  it("passes a ledger deeper inside the mount path", () => {
    const env = { ...railwayEnv(), CAROUSEL_LICENSE_LEDGER: "/data/licences/2026.jsonl" };
    expect(assertProductionEnv(env)).toEqual([]);
  });

  it("refuses a Railway boot with no volume attached, and says what resets", () => {
    const env = railwayEnv();
    delete env.RAILWAY_VOLUME_MOUNT_PATH;
    delete env.RAILWAY_VOLUME_NAME;

    const problems = assertProductionEnv(env);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("RAILWAY_VOLUME_MOUNT_PATH");
    expect(problems[0]).toContain("CAROUSEL_LICENSE_LEDGER");
    // The message has to name the consequence, not just the misconfiguration:
    // an operator reading a deploy log at 2am needs to know that shipping this
    // means re-selling seat numbers, not that a variable is unset.
    expect(problems[0]).toMatch(/replica/i);
    expect(problems[0]).toMatch(/seat|licence/i);
  });

  it("refuses a ledger that sits outside the mount path, and names the mount path", () => {
    const env = { ...railwayEnv(), CAROUSEL_LICENSE_LEDGER: "/app/licences.jsonl" };

    const problems = assertProductionEnv(env);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/data");
    expect(problems[0]).toContain("CAROUSEL_LICENSE_LEDGER");
  });

  it("is not fooled by a sibling directory that shares a prefix with the mount path", () => {
    // /database is not inside /data, however much it looks like it is to
    // startsWith. Getting this wrong would wave through the exact deployment
    // the check exists to stop.
    const env = { ...railwayEnv(), CAROUSEL_LICENSE_LEDGER: "/database/licences.jsonl" };
    expect(assertProductionEnv(env)).toHaveLength(1);
  });

  it("refuses a path that climbs out of the volume with ..", () => {
    const env = { ...railwayEnv(), CAROUSEL_LICENSE_LEDGER: "/data/../app/licences.jsonl" };
    expect(assertProductionEnv(env)).toHaveLength(1);
  });

  it("refuses a relative ledger path on Railway", () => {
    // `./data/licences.jsonl` resolves against the container's working
    // directory, which is not the volume — Railway's own docs call this out.
    const env = { ...railwayEnv(), CAROUSEL_LICENSE_LEDGER: "data/licences.jsonl" };
    expect(assertProductionEnv(env)).toHaveLength(1);
  });

  it("stays silent off Railway, where we cannot know the disk layout", () => {
    // The docker-compose self-host path (DEPLOY.md §2) has no volume variables
    // at all. Guessing there would crash-loop a correct deployment.
    expect(assertProductionEnv(completeEnv())).toEqual([]);
  });

  it("does not repeat the per-variable complaint when the ledger path is missing", () => {
    const env = railwayEnv();
    delete env.CAROUSEL_LICENSE_LEDGER;

    const problems = assertProductionEnv(env);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("CAROUSEL_LICENSE_LEDGER is not set");
  });
});

describe("the ledger writability probe", () => {
  const dirs: string[] = [];

  function scratch(): string {
    const dir = mkdtempSync(join(tmpdir(), "carousel-ledger-"));
    dirs.push(dir);
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      // Restore write permission first, or the cleanup fails on the very
      // directory this suite made read-only.
      try {
        chmodSync(dir, 0o700);
      } catch {
        // Already writable, or already gone.
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes when the ledger directory is writable", () => {
    const path = join(scratch(), "licences.jsonl");
    expect(assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: path })).toEqual([]);
  });

  it("creates the ledger directory at boot rather than at first sale", () => {
    const dir = join(scratch(), "nested", "deeper");
    const path = join(dir, "licences.jsonl");

    expect(assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: path })).toEqual([]);
    expect(existsSync(dir)).toBe(true);
  });

  it("passes when an existing ledger file is writable", () => {
    const path = join(scratch(), "licences.jsonl");
    writeFileSync(path, '{"id":"existing"}\n', "utf8");
    expect(assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: path })).toEqual([]);
  });

  it("refuses a read-only ledger directory, and names RAILWAY_RUN_UID", () => {
    // This is the real Railway failure: volumes mount as root, this image runs
    // as `node`, and FileLedger.record() swallows the EACCES — so without this
    // probe the first $9 purchase is served from memory and recorded nowhere.
    const dir = scratch();
    chmodSync(dir, 0o500);

    const problems = assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: join(dir, "licences.jsonl") });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("RAILWAY_RUN_UID=0");
    expect(problems[0]).toMatch(/not writable|cannot be created/);
  });

  it("refuses a read-only ledger file inside a writable directory", () => {
    // The nastier variant: appends fail while the directory looks fine, which
    // is exactly the state in which we keep selling and record nothing.
    const dir = scratch();
    const path = join(dir, "licences.jsonl");
    writeFileSync(path, '{"id":"existing"}\n', "utf8");
    chmodSync(path, 0o400);

    const problems = assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: path });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(path);
  });

  it("refuses a ledger directory that cannot be created at all", () => {
    const dir = scratch();
    chmodSync(dir, 0o500);

    const problems = assertLedgerWritable({
      CAROUSEL_LICENSE_LEDGER: join(dir, "nested", "licences.jsonl"),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("cannot be created");
  });

  it("says nothing when there is no file-backed ledger to check", () => {
    // Dev and the test suite run on MemoryLedger. The production contract
    // already refuses that in production; the probe must not say it twice.
    expect(assertLedgerWritable({})).toEqual([]);
    expect(assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: "   " })).toEqual([]);
  });

  it("writes nothing into the ledger directory to find out whether it can", () => {
    // A probe file on the volume would be a lie in the ledger's own folder, and
    // two processes racing to create it would be worse. Permission check only.
    const dir = scratch();
    mkdirSync(join(dir, "keep"), { recursive: true });

    expect(assertLedgerWritable({ CAROUSEL_LICENSE_LEDGER: join(dir, "licences.jsonl") })).toEqual(
      [],
    );
    expect(existsSync(join(dir, "licences.jsonl"))).toBe(false);
  });
});

/**
 * The Railway config in `.railway/railway.ts` is the only record of the replica
 * pin that a reviewer can read, and nothing in a normal build evaluates it —
 * Railway does not read `.railway/` during a deploy, and `railway config apply`
 * is run by hand. So this block runs the authoring file the way the CLI does
 * and asserts what it compiles to. Without it, "pinned to one replica in version
 * control" is a sentence in a comment again: someone edits the number, CI stays
 * green, and the next `railway config apply` quietly scales the licence ledger.
 */
describe("the Railway configuration in version control", () => {
  async function compiled() {
    const ctx = createRailwayContext({ command: "plan", environment: "production" });
    const definition = await railwayProgram(ctx, project);
    const resources = definition.resources ?? [];
    // A config that declares no resources would pass every assertion below by
    // vacuous truth, so fail loudly here instead.
    expect(resources.length).toBeGreaterThan(0);
    const service = resources.find((r) => (r as { type?: string }).type === "service") as {
      name: string;
      deploy?: { numReplicas?: number; healthcheckPath?: string; restartPolicyType?: string };
      volumeAttachments?: Record<string, { mountPath?: string }>;
    };
    return { definition, service };
  }

  it("pins the service to exactly one replica", async () => {
    const { service } = await compiled();
    // `replicas: 1` in the authoring file has to land in the field Railway
    // actually reads. Asserting the compiled value, not the source text, is the
    // difference between checking the pin and checking that we wrote a 1 down.
    expect(service.deploy?.numReplicas).toBe(1);
  });

  it("points the healthcheck at /api/health, not /", async () => {
    const { service } = await compiled();
    // "/" renders fine on a deployment with no bot shield and no weekly cap, so
    // it proves only that Node is listening.
    expect(service.deploy?.healthcheckPath).toBe("/api/health");
  });

  it("crash-loops a misconfigured boot instead of reporting it healthy", async () => {
    const { service } = await compiled();
    expect(service.deploy?.restartPolicyType).toBe("ON_FAILURE");
  });

  it("attaches a volume, which is what Railway itself enforces the pin with", async () => {
    const { service } = await compiled();
    // Railway refuses replicas on a service with a volume attached, so this
    // mount is the platform-enforced half of the pin. Lose it and the only
    // thing left is a number in a file nobody applied.
    const mounts = Object.values(service.volumeAttachments ?? {}).map((v) => v.mountPath);
    expect(mounts).toEqual(["/data"]);
  });

  it("mounts the volume where DEPLOY.md tells operators to put the ledger", async () => {
    const { service } = await compiled();
    const mount = Object.values(service.volumeAttachments ?? {})[0]?.mountPath as string;

    // The boot invariant refuses a ledger outside the mount path, so the mount
    // path in the Railway config and the path in the deploy instructions have
    // to agree or the documented setup crash-loops.
    const documented = { ...railwayEnv(), RAILWAY_VOLUME_MOUNT_PATH: mount };
    expect(assertProductionEnv(documented)).toEqual([]);
  });

  it("declares no variables, so an apply cannot propose deleting the secrets", async () => {
    const { service } = await compiled();
    // An `env` block is a claim about the whole variable set. A partial one
    // plans the deletion of everything it omits — which here is every
    // Flutterwave and licence secret.
    expect((service as { variables?: unknown }).variables).toBeUndefined();
  });
});
