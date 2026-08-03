import { MemoryTtlCache } from "./cache/ttl-cache.js";
import { createApp } from "./app/create-app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./logging/logger.js";
import type { AvailabilityProvider } from "./providers/interfaces.js";
import { DeterministicRankingEngine } from "./ranking/engine.js";
import { WatchmodeClient } from "./watchmode/client.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const cache = new MemoryTtlCache();
const unavailableProvider: AvailabilityProvider = {
  getProviders: () => Promise.reject(new Error("WATCHMODE_API_KEY is not configured")),
  resolveTitleById: () => Promise.resolve(null),
  resolveTitleByImdb: () => Promise.resolve(null),
  getMovieOffers: () => Promise.resolve([]),
  getEpisodeOffers: () => Promise.resolve([]),
};
const provider = env.WATCHMODE_API_KEY
  ? new WatchmodeClient({
      apiKey: env.WATCHMODE_API_KEY,
      cache,
      logger,
      timeoutMs: env.REQUEST_TIMEOUT_MS,
      maxRetries: env.WATCHMODE_MAX_RETRIES,
      episodeLinksEnabled: env.WATCHMODE_EPISODE_LINKS_ENABLED,
      providerTtlMs: env.CACHE_PROVIDER_TTL_SECONDS * 1000,
      titleTtlMs: env.CACHE_TITLE_TTL_SECONDS * 1000,
      sourceTtlMs: env.CACHE_SOURCE_TTL_SECONDS * 1000,
      negativeTtlMs: env.CACHE_NEGATIVE_TTL_SECONDS * 1000,
    })
  : unavailableProvider;
const app = createApp({ env, logger, provider, ranking: new DeterministicRankingEngine() });
const server = app.listen(env.PORT, "0.0.0.0", () =>
  logger.info("server_started", { port: env.PORT, environment: env.NODE_ENV }),
);
let closing = false;
const shutdown = (signal: string) => {
  if (closing) return;
  closing = true;
  logger.info("server_stopping", { signal });
  server.close((error) => {
    if (error) {
      logger.error("server_stop_failed", { category: error.name });
      process.exitCode = 1;
    }
  });
  setTimeout(() => {
    logger.error("server_stop_timeout");
    process.exitCode = 1;
    server.closeAllConnections();
  }, 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
