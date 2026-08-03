import { describe, expect, it, vi } from "vitest";
import { MemoryTtlCache } from "../../src/cache/ttl-cache.js";
import type { Logger } from "../../src/logging/logger.js";
import { WatchmodeClient, WatchmodeError } from "../../src/watchmode/client.js";

function client(fetcher: typeof fetch, maxRetries = 0, logger?: Logger) {
  return new WatchmodeClient({
    apiKey: "super-secret-key",
    cache: new MemoryTtlCache(),
    logger: logger ?? {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    fetch: fetcher,
    timeoutMs: 20,
    maxRetries,
    providerTtlMs: 1000,
    titleTtlMs: 1000,
    sourceTtlMs: 1000,
    negativeTtlMs: 50,
  });
}
const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });

function requestPath(input: string | URL | Request): string {
  if (input instanceof Request) return new URL(input.url).pathname;
  return new URL(input).pathname;
}

describe("Watchmode client", () => {
  it("normalizes successful providers and offers", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input) === "/v1/sources"
          ? jsonResponse([
              {
                id: 371,
                name: "Apple TV+",
                type: "sub",
                logo_100px: "https://cdn.watchmode.com/logo.jpg",
                regions: ["US"],
              },
            ])
          : jsonResponse([
              {
                source_id: 371,
                name: "Apple TV+",
                type: "sub",
                region: "US",
                android_tv_url: "https://tv.apple.com/show/example",
                web_url: "https://tv.apple.com/show/example",
              },
            ]),
      ),
    ) as unknown as typeof fetch;
    const instance = client(fetcher);
    expect((await instance.getProviders("US"))[0]?.name).toBe("Apple TV+");
    expect((await instance.getMovieOffers("1", "US"))[0]).toMatchObject({
      type: "subscription",
      destinationKind: "android_tv",
    });
  });
  it("resolves IMDb titles and negative-caches misses", async () => {
    const fetcher = vi.fn(() =>
      Promise.resolve(jsonResponse({ title_results: [], people_results: [] })),
    ) as unknown as typeof fetch;
    const instance = client(fetcher);
    expect(await instance.resolveTitleByImdb("tt1234567")).toBeNull();
    expect(await instance.resolveTitleByImdb("tt1234567")).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("deduplicates concurrent title requests", async () => {
    const fetcher = vi.fn(async () => {
      await Promise.resolve();
      return jsonResponse({
        title_results: [{ id: 1, name: "Movie", type: "movie", imdb_id: "tt1234567" }],
      });
    }) as unknown as typeof fetch;
    const instance = client(fetcher);
    await Promise.all([
      instance.resolveTitleByImdb("tt1234567"),
      instance.resolveTitleByImdb("tt1234567"),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retries temporary and rate-limited responses", async () => {
    for (const status of [429, 503]) {
      const fetcher = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({}, status))
        .mockResolvedValueOnce(jsonResponse([])) as unknown as typeof fetch;
      await client(fetcher, 1).getProviders("US");
      expect(fetcher).toHaveBeenCalledTimes(2);
    }
  });
  it("reports timeout and permanent failures with typed errors", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "AbortError" });
    const timeoutFetch = vi.fn(() => Promise.reject(timeout)) as unknown as typeof fetch;
    await expect(client(timeoutFetch).getProviders("US")).rejects.toMatchObject({
      category: "timeout",
    });
    const badFetch = vi.fn(() => Promise.resolve(jsonResponse({}, 401))) as unknown as typeof fetch;
    await expect(client(badFetch).getProviders("US")).rejects.toBeInstanceOf(WatchmodeError);
  });
  it("handles empty sources and does not leak the API key into logs or URLs", async () => {
    const logs: unknown[] = [];
    const logger: Logger = {
      debug: (_event, fields) => logs.push(fields),
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    };
    const mockFetch = vi.fn((_input: string | URL | Request) => Promise.resolve(jsonResponse([])));
    expect(
      await client(mockFetch as unknown as typeof fetch, 0, logger).getMovieOffers("1", "US"),
    ).toEqual([]);
    expect(JSON.stringify(logs)).not.toContain("super-secret-key");
    expect(mockFetch.mock.calls[0]?.[0]).not.toContain("super-secret-key");
  });
  it("uses series fallback when exact episode sources have no valid link", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).includes("episodes")
          ? jsonResponse([
              {
                id: 9,
                season_number: 1,
                episode_number: 1,
                sources: [
                  {
                    source_id: 371,
                    name: "Apple TV+",
                    type: "sub",
                    region: "US",
                    web_url: "Episode links available for paid plans only.",
                  },
                ],
              },
            ])
          : jsonResponse([
              {
                source_id: 371,
                name: "Apple TV+",
                type: "sub",
                region: "US",
                web_url: "https://tv.apple.com/show/example",
              },
            ]),
      ),
    ) as unknown as typeof fetch;
    expect((await client(fetcher).getEpisodeOffers("1", 1, 1, "US"))[0]).toMatchObject({
      seriesFallback: true,
      exactEpisode: false,
    });
  });
});
