import type { MediaTitleId, NormalizedOffer, Provider, ResolvedTitle } from "../types/models.js";
import type { AddonConfig } from "../config/schema.js";

export interface AvailabilityProvider {
  getProviders(country: string): Promise<Provider[]>;
  resolveTitleById(titleId: MediaTitleId): Promise<ResolvedTitle | null>;
  resolveTitleByImdb(imdbId: string): Promise<ResolvedTitle | null>;
  getMovieOffers(titleId: string, country: string): Promise<NormalizedOffer[]>;
  getEpisodeOffers(
    titleId: string,
    season: number,
    episode: number,
    country: string,
  ): Promise<NormalizedOffer[]>;
}

export interface WatchmodeClientContract extends AvailabilityProvider {
  readonly upstream: "watchmode";
}

export interface DestinationUrlResolver {
  resolve(
    candidates: Partial<Record<"android_tv" | "android" | "app_link" | "web", string>>,
  ): { url: string; kind: "android_tv" | "android" | "app_link" | "web" } | undefined;
}

export interface RankingEngine {
  rank(offers: NormalizedOffer[], config: AddonConfig): NormalizedOffer[];
}
