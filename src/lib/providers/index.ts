/**
 * Public surface of the provider system. Import the orchestrator and config
 * from here; the individual writers/researchers stay internal.
 */

export { generateDeck } from "./generate";
export type { GenerateArgs, GenerateOutput } from "./generate";
export { resolveConfig, envFromProcess, pickResearchSource } from "./config";
export type { Env, ResolvedConfig, WriterConfig } from "./config";
export {
  checkRateLimit,
  rateLimitConfigFromEnv,
  clientIdFromHeaders,
  resetRateLimit,
  setRateLimitStore,
  MemoryRateLimitStore,
} from "./ratelimit";
export type { RateLimitConfig, RateDecision, RateLimitStore } from "./ratelimit";
export type { WriterKind, ResearchSource, ProviderEvent } from "./types";
