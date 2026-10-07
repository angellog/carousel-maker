import { defineConfig } from "vitest/config";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";

// The @napi-rs/canvas render suites are CPU-bound and collection across all 38
// test files takes ~100s. With an unbounded pool those renders starved plain
// synchronous tests in unrelated files until they tripped vitest's 5s default
// timeout — a load-induced flake, not a slow assertion. Bound the pool and give
// every test real headroom instead of patching individual tests.
//
// Floor of 2, not 1: on a 2-vCPU runner `availableParallelism() - 1` is 1, which
// collapses the whole suite to a single serial fork. Two forks on two cores is
// not oversubscribed, and the CPU-bound renders dominate the wall clock anyway.
const maxWorkers = Math.max(2, Math.min(4, availableParallelism() - 1));

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    maxConcurrency: 4,
    pool: "forks",
    poolOptions: {
      forks: { minForks: 1, maxForks: maxWorkers },
    },
  },
});
