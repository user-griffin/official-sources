import { createApp } from "../dist/app/create-app.js";
import { loadEnv } from "../dist/config/env.js";
import { encodeConfig } from "../dist/config/token.js";
import { silentLogger } from "../dist/logging/logger.js";
import { DeterministicRankingEngine } from "../dist/ranking/engine.js";

const provider = {
  async getProviders() {
    return [{ id: 371, name: "Apple TV+", type: "subscription", regions: ["US"] }];
  },
  async resolveTitleByImdb(imdbId) {
    return { id: "123", imdbId, name: "Severance", type: "series" };
  },
  async getMovieOffers() {
    return [];
  },
  async getEpisodeOffers() {
    return [
      {
        providerId: 371,
        providerName: "Apple TV+",
        type: "subscription",
        destinationUrl: "https://tv.apple.com/episode/severance-example",
        destinationKind: "android_tv",
        exactEpisode: true,
        seriesFallback: false,
        sourceProvider: "watchmode",
      },
    ];
  },
};
const env = loadEnv({ NODE_ENV: "test", RATE_LIMIT_MAX: "1000" });
const app = createApp({
  env,
  logger: silentLogger,
  provider,
  ranking: new DeterministicRankingEngine(),
});
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("No server address");
const base = `http://127.0.0.1:${address.port}`;
const config = {
  v: 1,
  country: "US",
  providers: [371],
  providerOrder: [371],
  selectedFirst: true,
  showSubscription: true,
  showFree: true,
  showAds: true,
  showTvEverywhere: false,
  showRent: false,
  showPurchase: false,
  showUnselected: false,
  hideInvalidLinks: true,
  collapseDuplicates: true,
  allowSeriesFallback: true,
  showSeriesFallback: true,
  showPrices: true,
};
const token = encodeConfig(config);
const paths = [
  "/health",
  "/version",
  "/manifest.json",
  `/c/${token}/manifest.json`,
  `/c/${token}/stream/series/tt11280740:1:1.json`,
];
const results = {};
try {
  for (const path of paths) {
    const response = await fetch(base + path);
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    results[path] = await response.json();
  }
  const streams = results[paths.at(-1)].streams;
  if (!streams?.[0]?.externalUrl?.includes("tv.apple.com"))
    throw new Error("Mocked Apple TV+ externalUrl missing");
  if (JSON.stringify(results).includes("WATCHMODE_API_KEY"))
    throw new Error("Secret marker leaked");
  process.stdout.write(
    JSON.stringify({ status: "ok", checks: paths.length, appleTvExternalUrl: true }) + "\n",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
