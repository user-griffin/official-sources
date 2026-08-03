import { describe, expect, it } from "vitest";
import { MemoryTtlCache } from "../../src/cache/ttl-cache.js";
import { silentLogger } from "../../src/logging/logger.js";
import { WatchmodeClient } from "../../src/watchmode/client.js";

const key = process.env.WATCHMODE_API_KEY;
describe.skipIf(!key)("live Watchmode smoke", () => {
  const client = new WatchmodeClient({
    apiKey: key ?? "",
    cache: new MemoryTtlCache(),
    logger: silentLogger,
    timeoutMs: 8000,
    maxRetries: 1,
    episodeLinksEnabled: false,
    providerTtlMs: 1000,
    titleTtlMs: 1000,
    sourceTtlMs: 1000,
    negativeTtlMs: 1000,
  });
  it("resolves a movie, a series, and availability", async () => {
    const movie = await client.resolveTitleByImdb("tt0111161");
    const series = await client.resolveTitleByImdb("tt11280740");
    expect(movie?.id).toBeTruthy();
    expect(series?.id).toBeTruthy();
    if (movie) expect(Array.isArray(await client.getMovieOffers(movie.id, "US"))).toBe(true);
  });
});
