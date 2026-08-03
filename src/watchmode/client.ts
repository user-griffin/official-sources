import type { z } from "zod";
import type { Cache } from "../cache/ttl-cache.js";
import type { Logger } from "../logging/logger.js";
import type { WatchmodeClientContract } from "../providers/interfaces.js";
import { SafeDestinationResolver } from "../security/destination.js";
import type { NormalizedOffer, OfferType, Provider, ResolvedTitle } from "../types/models.js";
import {
  wmEpisodesSchema,
  wmProvidersSchema,
  wmSearchSchema,
  wmSourcesSchema,
  type wmSourceSchema,
} from "./schemas.js";

export type FetchLike = typeof fetch;
export class WatchmodeError extends Error {
  constructor(
    public readonly category:
      "timeout" | "rate_limit" | "temporary" | "permanent" | "invalid_response",
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "WatchmodeError";
  }
}

interface ClientOptions {
  apiKey: string;
  cache: Cache;
  logger: Logger;
  fetch?: FetchLike;
  timeoutMs: number;
  maxRetries: number;
  providerTtlMs: number;
  titleTtlMs: number;
  sourceTtlMs: number;
  negativeTtlMs: number;
}
type WmSource = z.infer<typeof wmSourceSchema>;

function sourceType(type: WmSource["type"]): OfferType {
  return (
    {
      sub: "subscription",
      rent: "rent",
      buy: "purchase",
      free: "ads",
      tve: "tv_everywhere",
    } as const
  )[type];
}
function providerType(type: "sub" | "purchase" | "free" | "tve"): Provider["type"] {
  return (
    { sub: "subscription", purchase: "purchase", free: "free", tve: "tv_everywhere" } as const
  )[type];
}
function currency(country: string): string | undefined {
  return (
    {
      US: "USD",
      CA: "CAD",
      GB: "GBP",
      AU: "AUD",
      NZ: "NZD",
      JP: "JPY",
      IN: "INR",
      DE: "EUR",
      FR: "EUR",
      ES: "EUR",
      IT: "EUR",
      NL: "EUR",
    } as Record<string, string>
  )[country];
}

export class WatchmodeClient implements WatchmodeClientContract {
  readonly upstream = "watchmode" as const;
  private readonly baseUrl = "https://api.watchmode.com/v1";
  private readonly destination = new SafeDestinationResolver();
  private readonly fetcher: FetchLike;
  constructor(private readonly options: ClientOptions) {
    this.fetcher = options.fetch ?? fetch;
  }

  private async request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const safePath = path.replace(/apiKey=[^&]+/gi, "apiKey=[REDACTED]");
    for (let attempt = 0; ; attempt += 1) {
      this.options.logger.debug("watchmode_request", {
        upstream: "watchmode",
        path: safePath,
        attempt,
      });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await this.fetcher(`${this.baseUrl}${path}`, {
          headers: { "X-API-Key": this.options.apiKey, Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) {
          const category =
            response.status === 429
              ? "rate_limit"
              : response.status >= 500
                ? "temporary"
                : "permanent";
          if (
            (category === "rate_limit" || category === "temporary") &&
            attempt < this.options.maxRetries
          ) {
            const retryAfter = Number(response.headers.get("retry-after"));
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Number.isFinite(retryAfter)
                  ? Math.min(retryAfter * 1000, 5000)
                  : Math.min(100 * 2 ** attempt + Math.random() * 50, 2000),
              ),
            );
            continue;
          }
          throw new WatchmodeError(
            category,
            `Watchmode request failed (${response.status})`,
            response.status,
          );
        }
        const text = await response.text();
        if (text.length > 2_000_000)
          throw new WatchmodeError("invalid_response", "Watchmode response was too large");
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new WatchmodeError("invalid_response", "Watchmode returned invalid JSON");
        }
        const parsed = schema.safeParse(json);
        if (!parsed.success)
          throw new WatchmodeError("invalid_response", "Watchmode returned an unexpected response");
        return parsed.data;
      } catch (error) {
        if (error instanceof WatchmodeError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          if (attempt < this.options.maxRetries) continue;
          throw new WatchmodeError("timeout", "Watchmode request timed out");
        }
        if (attempt < this.options.maxRetries) continue;
        throw new WatchmodeError("temporary", "Watchmode request failed");
      } finally {
        clearTimeout(timer);
      }
    }
  }

  async getProviders(country: string): Promise<Provider[]> {
    const key = `wm:providers:${country}`;
    const cached = this.options.cache.get<Provider[]>(key);
    this.options.logger.debug("cache_lookup", {
      upstream: "watchmode",
      cache: "providers",
      hit: cached !== undefined,
    });
    if (cached !== undefined) return cached;
    return this.options.cache.getOrSet(key, this.options.providerTtlMs, async () => {
      const items = await this.request(
        `/sources?regions=${encodeURIComponent(country)}`,
        wmProvidersSchema,
      );
      return items
        .filter((item) => item.regions.includes(country))
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: providerType(item.type),
          regions: item.regions,
          ...(item.logo_100px ? { logoUrl: item.logo_100px } : {}),
        }));
    });
  }

  async resolveTitleByImdb(imdbId: string): Promise<ResolvedTitle | null> {
    const key = `wm:title:${imdbId}`;
    const cached = this.options.cache.get<ResolvedTitle | null>(key);
    this.options.logger.debug("cache_lookup", {
      upstream: "watchmode",
      cache: "title",
      hit: cached !== undefined,
    });
    if (cached !== undefined) return cached;
    return this.options.cache.getOrSet(
      key,
      (value) => (value ? this.options.titleTtlMs : this.options.negativeTtlMs),
      async () => {
        const result = await this.request(
          `/search?search_field=imdb_id&search_value=${encodeURIComponent(imdbId)}`,
          wmSearchSchema,
        );
        const item =
          result.title_results.find((candidate) => candidate.imdb_id === imdbId) ??
          result.title_results[0];
        return item
          ? {
              id: String(item.id),
              imdbId,
              name: item.name,
              type: item.type === "movie" ? ("movie" as const) : ("series" as const),
            }
          : null;
      },
    );
  }

  private normalize(
    items: WmSource[],
    country: string,
    exactEpisode: boolean,
    seriesFallback: boolean,
  ): NormalizedOffer[] {
    return items
      .filter((item) => item.region === country)
      .map((item) => {
        const destination = this.destination.resolve({
          ...(item.android_tv_url ? { android_tv: item.android_tv_url } : {}),
          ...(item.android_url ? { android: item.android_url } : {}),
          ...(item.web_url ? { web: item.web_url } : {}),
        });
        const offerCurrency = currency(country);
        return {
          providerId: item.source_id,
          providerName: item.name,
          type: sourceType(item.type),
          ...(item.price != null ? { price: item.price } : {}),
          ...(offerCurrency ? { currency: offerCurrency } : {}),
          ...(item.format ? { quality: item.format } : {}),
          ...(destination
            ? { destinationUrl: destination.url, destinationKind: destination.kind }
            : {}),
          exactEpisode,
          seriesFallback,
          sourceProvider: "watchmode" as const,
        };
      });
  }

  async getMovieOffers(titleId: string, country: string): Promise<NormalizedOffer[]> {
    const key = `wm:sources:${titleId}:${country}`;
    const cached = this.options.cache.get<NormalizedOffer[]>(key);
    this.options.logger.debug("cache_lookup", {
      upstream: "watchmode",
      cache: "sources",
      hit: cached !== undefined,
    });
    if (cached !== undefined) return cached;
    return this.options.cache.getOrSet(
      key,
      (offers) => (offers.length ? this.options.sourceTtlMs : this.options.negativeTtlMs),
      async () => {
        const items = await this.request(
          `/title/${encodeURIComponent(titleId)}/sources?regions=${encodeURIComponent(country)}`,
          wmSourcesSchema,
        );
        return this.normalize(items, country, false, false);
      },
    );
  }

  async getEpisodeOffers(
    titleId: string,
    season: number,
    episode: number,
    country: string,
  ): Promise<NormalizedOffer[]> {
    const key = `wm:episode:${titleId}:${season}:${episode}:${country}`;
    const cached = this.options.cache.get<NormalizedOffer[]>(key);
    this.options.logger.debug("cache_lookup", {
      upstream: "watchmode",
      cache: "episode",
      hit: cached !== undefined,
    });
    if (cached !== undefined) return cached;
    return this.options.cache.getOrSet(
      key,
      (offers) => (offers.length ? this.options.sourceTtlMs : this.options.negativeTtlMs),
      async () => {
        const episodes = await this.request(
          `/title/${encodeURIComponent(titleId)}/episodes?season=${season}&episode=${episode}&regions=${encodeURIComponent(country)}&limit=1`,
          wmEpisodesSchema,
        );
        const exact = episodes[0]?.sources ?? [];
        const exactOffers = this.normalize(exact, country, true, false);
        if (exactOffers.some((offer) => offer.destinationUrl)) return exactOffers;
        const series = await this.request(
          `/title/${encodeURIComponent(titleId)}/sources?regions=${encodeURIComponent(country)}`,
          wmSourcesSchema,
        );
        return this.normalize(series, country, false, true);
      },
    );
  }
}
