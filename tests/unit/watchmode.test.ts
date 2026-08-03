import { describe, expect, it, vi } from "vitest";
import { MemoryTtlCache } from "../../src/cache/ttl-cache.js";
import type { Logger } from "../../src/logging/logger.js";
import { WatchmodeClient, WatchmodeError } from "../../src/watchmode/client.js";

function client(
  fetcher: typeof fetch,
  maxRetries = 0,
  logger?: Logger,
  episodeLinksEnabled = true,
) {
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
    episodeLinksEnabled,
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
    const fetcher = vi.fn((input: string | URL | Request) => {
      const path = requestPath(input);
      return Promise.resolve(
        path === "/v1/sources"
          ? jsonResponse([
              {
                id: 371,
                name: "Apple TV+",
                type: "sub",
                logo_100px: "https://cdn.watchmode.com/logo.jpg",
                regions: ["US"],
              },
            ])
          : path.endsWith("/details")
            ? jsonResponse({
                id: 1,
                title: "Example",
                type: "movie",
                network_names: ["Apple TV+"],
              })
            : jsonResponse([
                {
                  source_id: 371,
                  name: "Apple TV+",
                  type: "sub",
                  region: "US",
                  android_tv_url: "https://tv.apple.com/us/show/example/umc.cmc.example",
                  web_url: "https://tv.apple.com/us/show/example/umc.cmc.example",
                },
              ]),
      );
    }) as unknown as typeof fetch;
    const instance = client(fetcher);
    expect((await instance.getProviders("US"))[0]?.name).toBe("Apple TV+");
    expect((await instance.getMovieOffers("1", "US"))[0]).toMatchObject({
      type: "subscription",
      destinationKind: "android_tv",
    });
  });
  it("normalizes Watchmode free sources as globally eligible free offers", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).endsWith("/details")
          ? jsonResponse({ id: 1, title: "Movie", type: "movie", network_names: [] })
          : jsonResponse([
              {
                source_id: 365,
                name: "Amazon Freevee",
                type: "free",
                region: "US",
                web_url: "https://www.amazon.com/gp/video/detail/example",
              },
            ]),
      ),
    ) as unknown as typeof fetch;
    expect((await client(fetcher).getMovieOffers("1", "US"))[0]?.type).toBe("free");
  });
  it("suppresses a marketplace channel variant when the direct service is available", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).endsWith("/details")
          ? jsonResponse({
              id: 1,
              title: "Series",
              type: "series",
              network_names: ["Apple TV+"],
            })
          : jsonResponse([
              {
                source_id: 371,
                name: "Apple TV+",
                type: "sub",
                region: "US",
                web_url: "https://tv.apple.com/show/severance",
              },
              {
                source_id: 900,
                name: "AppleTV+ Amazon Channel",
                type: "sub",
                region: "US",
                web_url: "https://www.amazon.com/gp/video/detail/severance",
              },
            ]),
      ),
    ) as unknown as typeof fetch;

    const offers = await client(fetcher).getMovieOffers("1", "US");

    expect(offers.map((offer) => offer.providerName)).toEqual(["Apple TV+"]);
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
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      await Promise.resolve();
      if (requestPath(input).endsWith("/details")) {
        return jsonResponse({
          id: 1,
          title: "Movie",
          type: "movie",
          imdb_id: "tt1234567",
          network_names: [],
        });
      }
      return jsonResponse({
        title_results: [{ id: 1, name: "Movie", type: "movie", imdb_id: "tt1234567" }],
      });
    }) as unknown as typeof fetch;
    const instance = client(fetcher);
    await Promise.all([
      instance.resolveTitleByImdb("tt1234567"),
      instance.resolveTitleByImdb("tt1234567"),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
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
  it("uses a labeled series fallback when exact episode sources have no valid link", async () => {
    const mockFetch = vi.fn((input: string | URL | Request) =>
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
                web_url: "https://tv.apple.com/us/show/example/umc.cmc.example",
              },
            ]),
      ),
    );
    const fetcher = mockFetch as unknown as typeof fetch;
    expect((await client(fetcher).getEpisodeOffers("1", 1, 1, "US"))[0]).toMatchObject({
      seriesFallback: true,
      exactEpisode: false,
      seasonNumber: 1,
      episodeNumber: 1,
    });
  });
  it("skips the unavailable episode endpoint on the free plan", async () => {
    const mockFetch = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).endsWith("/details")
          ? jsonResponse({ id: 1, title: "Series", type: "series", network_names: [] })
          : jsonResponse([
              {
                source_id: 371,
                name: "Apple TV+",
                type: "sub",
                region: "US",
                web_url: "https://tv.apple.com/us/show/example/umc.cmc.example",
              },
            ]),
      ),
    );
    const fetcher = mockFetch as unknown as typeof fetch;
    const offers = await client(fetcher, 0, undefined, false).getEpisodeOffers("1", 1, 2, "US");
    expect(offers[0]).toMatchObject({ seriesFallback: true, seasonNumber: 1, episodeNumber: 2 });
    expect(mockFetch.mock.calls.some(([input]) => requestPath(input).includes("/episodes"))).toBe(
      false,
    );
  });
  it("excludes promotional free episodes from subscription providers in series fallbacks", async () => {
    const fetcher = vi.fn((input: string | URL | Request) => {
      const path = requestPath(input);
      if (path.endsWith("/details")) {
        return Promise.resolve(
          jsonResponse({ id: 1, title: "Series", type: "series", network_names: [] }),
        );
      }
      if (path === "/v1/sources") {
        return Promise.resolve(
          jsonResponse([
            { id: 26, name: "Prime Video", type: "sub", regions: ["US"] },
            { id: 73, name: "Tubi", type: "free", regions: ["US"] },
          ]),
        );
      }
      return Promise.resolve(
        jsonResponse([
          {
            source_id: 26,
            name: "Prime Video",
            type: "free",
            region: "US",
            web_url: "https://www.amazon.com/gp/video/detail/promotional-episode",
          },
          {
            source_id: 73,
            name: "Tubi",
            type: "free",
            region: "US",
            web_url: "https://tubitv.com/series/example",
          },
        ]),
      );
    }) as unknown as typeof fetch;

    const offers = await client(fetcher, 0, undefined, false).getEpisodeOffers("1", 1, 2, "US");

    expect(offers.map((offer) => offer.providerName)).toEqual(["Tubi"]);
  });
  it("preserves a title-associated Apple episode URL instead of replacing it with home", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).endsWith("/details")
          ? jsonResponse({ id: 1, title: "Series", type: "series", network_names: ["Apple TV+"] })
          : jsonResponse([
              {
                source_id: 371,
                name: "AppleTV+",
                type: "sub",
                region: "US",
                web_url: "https://tv.apple.com/us/episode/example/umc.cmc.episode",
              },
              {
                source_id: 900,
                name: "AppleTV+ Amazon Channel",
                type: "sub",
                region: "US",
                web_url: "https://watch.amazon.com/detail/example",
              },
            ]),
      ),
    ) as unknown as typeof fetch;
    const offers = await client(fetcher, 0, undefined, false).getEpisodeOffers("1", 1, 2, "US");
    expect(offers).toMatchObject([
      {
        providerId: 371,
        destinationUrl: "https://tv.apple.com/us/episode/example/umc.cmc.episode",
      },
    ]);
  });
  it("skips a home-screen Android link and falls back to a content-level web URL", async () => {
    const fetcher = vi.fn((input: string | URL | Request) =>
      Promise.resolve(
        requestPath(input).endsWith("/details")
          ? jsonResponse({ id: 1, title: "Series", type: "series", network_names: ["Apple TV+"] })
          : jsonResponse([
              {
                source_id: 371,
                name: "Apple TV+",
                type: "sub",
                region: "US",
                android_tv_url: "https://tv.apple.com/",
                web_url: "https://tv.apple.com/us/show/example/umc.cmc.example",
              },
            ]),
      ),
    ) as unknown as typeof fetch;
    const offers = await client(fetcher, 0, undefined, false).getEpisodeOffers("1", 1, 2, "US");
    expect(offers[0]).toMatchObject({
      destinationKind: "web",
      destinationUrl: "https://tv.apple.com/us/show/example/umc.cmc.example",
    });
  });
  it("matches the requested episode instead of trusting response order", async () => {
    const fetcher = vi.fn((input: string | URL | Request) => {
      const path = requestPath(input);
      if (path.endsWith("/details")) {
        return Promise.resolve(
          jsonResponse({ id: 1, title: "Series", type: "series", network_names: ["Netflix"] }),
        );
      }
      return Promise.resolve(
        jsonResponse([
          { id: 8, season_number: 1, episode_number: 1, sources: [] },
          {
            id: 9,
            season_number: 1,
            episode_number: 2,
            sources: [
              {
                source_id: 203,
                name: "Netflix",
                type: "sub",
                region: "US",
                web_url: "https://www.netflix.com/watch/123",
              },
            ],
          },
        ]),
      );
    }) as unknown as typeof fetch;
    expect((await client(fetcher).getEpisodeOffers("1", 1, 2, "US"))[0]).toMatchObject({
      providerId: 203,
      exactEpisode: true,
      isHomeProvider: true,
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });
});
