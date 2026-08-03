import type { z } from "zod";
import type { Cache } from "../cache/ttl-cache.js";
import type { Logger } from "../logging/logger.js";
import type { WatchmodeClientContract } from "../providers/interfaces.js";
import { isTitleLevelDestination, SafeDestinationResolver } from "../security/destination.js";
import type {
  MediaTitleId,
  NormalizedOffer,
  OfferType,
  Provider,
  ResolvedTitle,
} from "../types/models.js";
import {
  wmEpisodesSchema,
  wmProvidersSchema,
  wmSearchSchema,
  wmSourcesSchema,
  wmTitleDetailsSchema,
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
  episodeLinksEnabled: boolean;
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
      free: "free",
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

function marketplaceBaseName(name: string): string {
  return name
    .replace(/\s*\(via\s+(?:amazon prime|hulu|apple tv)\)\s*$/i, "")
    .replace(/\s+(?:amazon(?: prime)?|apple tv|hulu)\s+channel\s*$/i, "")
    .trim();
}

function canonicalServiceName(name: string): string {
  const compact = marketplaceBaseName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (/apple(tv|television)/.test(compact)) return "appletv";
  if (/amazon|primevideo/.test(compact)) return "primevideo";
  if (compact === "max" || compact.startsWith("hbo")) return "hbomax";
  if (/disney/.test(compact)) return "disneyplus";
  if (/paramount/.test(compact)) return "paramountplus";
  if (/peacock/.test(compact)) return "peacock";
  return compact.replace(/premium|channel|network|television|streaming/g, "").replace(/plus$/g, "");
}

function isMarketplaceVariant(name: string): boolean {
  return marketplaceBaseName(name) !== name.trim();
}

function preferDirectServiceOffers(items: NormalizedOffer[]): NormalizedOffer[] {
  const directServices = new Set(
    items
      .filter((item) => !isMarketplaceVariant(item.providerName))
      .map((item) => canonicalServiceName(item.providerName)),
  );
  return items.filter(
    (item) =>
      !isMarketplaceVariant(item.providerName) ||
      !directServices.has(canonicalServiceName(item.providerName)),
  );
}

function isHomeProvider(providerName: string, homeProviderNames: string[]): boolean {
  const provider = canonicalServiceName(providerName);
  return homeProviderNames.some((name) => {
    const home = canonicalServiceName(name);
    return (
      home.length >= 3 && (provider === home || provider.includes(home) || home.includes(provider))
    );
  });
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

  private async getTitleContext(
    titleId: string,
  ): Promise<{ imdbId?: string; homeProviderNames: string[] }> {
    const key = `wm:title-context:${titleId}`;
    const cached = this.options.cache.get<{ imdbId?: string; homeProviderNames: string[] }>(key);
    if (cached !== undefined) return cached;
    return this.options.cache.getOrSet(
      key,
      (value) =>
        value.homeProviderNames.length ? this.options.providerTtlMs : this.options.negativeTtlMs,
      async () => {
        try {
          const details = await this.request(
            `/title/${encodeURIComponent(titleId)}/details`,
            wmTitleDetailsSchema,
          );
          return {
            ...(details.imdb_id ? { imdbId: details.imdb_id } : {}),
            homeProviderNames: details.network_names ?? [],
          };
        } catch (error) {
          this.options.logger.warn("watchmode_title_context_unavailable", {
            upstream: "watchmode",
            category: error instanceof WatchmodeError ? error.category : "unknown",
          });
          return { homeProviderNames: [] };
        }
      },
    );
  }

  private async resolveBySearch(
    key: string,
    searchField: "imdb_id" | "tmdb_movie_id" | "tmdb_tv_id",
    searchValue: string,
    expectedType?: "movie" | "series",
    externalId?: MediaTitleId,
  ): Promise<ResolvedTitle | null> {
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
          `/search?search_field=${searchField}&search_value=${encodeURIComponent(searchValue)}`,
          wmSearchSchema,
        );
        const item = result.title_results.find((candidate) => {
          const type = candidate.type === "movie" ? "movie" : "series";
          return !expectedType || type === expectedType;
        });
        if (!item) return null;
        const type = item.type === "movie" ? ("movie" as const) : ("series" as const);
        const details = await this.getTitleContext(String(item.id));
        const imdbId = item.imdb_id ?? details.imdbId;
        const resolvedExternalId =
          externalId ??
          (imdbId ? ({ scheme: "imdb", value: imdbId, mediaType: type } as const) : null);
        if (!resolvedExternalId) return null;
        return {
          id: String(item.id),
          externalId: resolvedExternalId,
          ...(imdbId ? { imdbId } : {}),
          name: item.name,
          type,
          homeProviderNames: details.homeProviderNames,
        };
      },
    );
  }

  async resolveTitleByImdb(imdbId: string): Promise<ResolvedTitle | null> {
    return this.resolveBySearch(`wm:title:imdb:any:${imdbId}`, "imdb_id", imdbId);
  }

  async resolveTitleById(titleId: MediaTitleId): Promise<ResolvedTitle | null> {
    const field =
      titleId.scheme === "imdb"
        ? "imdb_id"
        : titleId.mediaType === "movie"
          ? "tmdb_movie_id"
          : "tmdb_tv_id";
    return this.resolveBySearch(
      `wm:title:${titleId.scheme}:${titleId.mediaType}:${titleId.value}`,
      field,
      String(titleId.value),
      titleId.mediaType,
      titleId,
    );
  }

  private normalize(
    items: WmSource[],
    country: string,
    exactEpisode: boolean,
    seriesFallback: boolean,
    homeProviderNames: string[],
    episodeContext?: { season: number; episode: number },
    catalogProviderTypes?: ReadonlyMap<number, Provider["type"]>,
  ): NormalizedOffer[] {
    const normalized = items
      .filter((item) => item.region === country)
      .filter((item) => {
        if (!seriesFallback || item.type !== "free") return true;
        const catalogType = catalogProviderTypes?.get(item.source_id);
        return catalogType === undefined || catalogType === "free";
      })
      .map((item) => {
        const destination = (
          [
            ["android_tv", item.android_tv_url],
            ["android", item.android_url],
            ["web", item.web_url],
          ] as const
        )
          .map(([kind, value]) => this.destination.resolve(value ? { [kind]: value } : {}))
          .find((candidate) =>
            candidate ? isTitleLevelDestination(candidate.url, item.name) : false,
          );
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
          ...(episodeContext
            ? { seasonNumber: episodeContext.season, episodeNumber: episodeContext.episode }
            : {}),
          sourceProvider: "watchmode" as const,
          ...(isHomeProvider(item.name, homeProviderNames) ? { isHomeProvider: true } : {}),
        };
      })
      .filter(
        (offer) =>
          !offer.destinationUrl ||
          isTitleLevelDestination(offer.destinationUrl, offer.providerName),
      );
    return preferDirectServiceOffers(normalized);
  }

  private async getSeriesFallbackProviderTypes(
    items: WmSource[],
    country: string,
  ): Promise<ReadonlyMap<number, Provider["type"]> | undefined> {
    if (!items.some((item) => item.type === "free")) return undefined;
    try {
      const providers = await this.getProviders(country);
      return new Map(providers.map((provider) => [provider.id, provider.type]));
    } catch (error) {
      this.options.logger.warn("watchmode_provider_types_unavailable", {
        upstream: "watchmode",
        category: error instanceof WatchmodeError ? error.category : "unknown",
      });
      return undefined;
    }
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
        const [items, context] = await Promise.all([
          this.request(
            `/title/${encodeURIComponent(titleId)}/sources?regions=${encodeURIComponent(country)}`,
            wmSourcesSchema,
          ),
          this.getTitleContext(titleId),
        ]);
        return this.normalize(items, country, false, false, context.homeProviderNames);
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
        if (!this.options.episodeLinksEnabled) {
          const [series, context] = await Promise.all([
            this.request(
              `/title/${encodeURIComponent(titleId)}/sources?regions=${encodeURIComponent(country)}`,
              wmSourcesSchema,
            ),
            this.getTitleContext(titleId),
          ]);
          const providerTypes = await this.getSeriesFallbackProviderTypes(series, country);
          return this.normalize(
            series,
            country,
            false,
            true,
            context.homeProviderNames,
            { season, episode },
            providerTypes,
          );
        }
        const [episodes, context] = await Promise.all([
          this.request(
            `/title/${encodeURIComponent(titleId)}/episodes?season=${season}&episode=${episode}&regions=${encodeURIComponent(country)}&limit=10`,
            wmEpisodesSchema,
          ),
          this.getTitleContext(titleId),
        ]);
        const exact = episodes.find(
          (item) => item.season_number === season && item.episode_number === episode,
        );
        const exactOffers = this.normalize(
          exact?.sources ?? [],
          country,
          true,
          false,
          context.homeProviderNames,
          { season, episode },
        );
        if (exactOffers.some((offer) => offer.destinationUrl)) return exactOffers;
        const series = await this.request(
          `/title/${encodeURIComponent(titleId)}/sources?regions=${encodeURIComponent(country)}`,
          wmSourcesSchema,
        );
        const providerTypes = await this.getSeriesFallbackProviderTypes(series, country);
        return this.normalize(
          series,
          country,
          false,
          true,
          context.homeProviderNames,
          { season, episode },
          providerTypes,
        );
      },
    );
  }
}
