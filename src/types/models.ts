export type OfferType = "subscription" | "free" | "ads" | "tv_everywhere" | "rent" | "purchase";

export type DestinationKind = "android_tv" | "android" | "app_link" | "web";

export interface Provider {
  id: number;
  name: string;
  type: "subscription" | "free" | "tv_everywhere" | "purchase";
  logoUrl?: string;
  regions: string[];
}

export interface ResolvedTitle {
  id: string;
  externalId: MediaTitleId;
  imdbId?: string;
  name: string;
  type: "movie" | "series";
  homeProviderNames: string[];
}

export interface NormalizedOffer {
  providerId: number;
  providerName: string;
  providerLogoUrl?: string;
  type: OfferType;
  price?: number;
  currency?: string;
  quality?: string;
  destinationUrl?: string;
  destinationKind?: DestinationKind;
  exactEpisode: boolean;
  seriesFallback: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
  sourceProvider: "watchmode";
  isHomeProvider?: boolean;
}

export type MediaTitleId =
  | { scheme: "imdb"; value: string; mediaType: "movie" | "series" }
  | { scheme: "tmdb"; value: number; mediaType: "movie" | "series" };

export type ParsedMediaId =
  | { kind: "movie"; titleId: MediaTitleId }
  | { kind: "episode"; titleId: MediaTitleId; season: number; episode: number };

export interface StremioStream {
  name: string;
  title: string;
  description?: string;
  externalUrl: string;
  behaviorHints: { notWebReady: true };
}
