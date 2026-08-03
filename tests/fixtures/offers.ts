import type { NormalizedOffer } from "../../src/types/models.js";

export const severanceAppleOffer: NormalizedOffer = {
  providerId: 371,
  providerName: "Apple TV+",
  type: "subscription",
  destinationUrl: "https://tv.apple.com/show/severance/umc.cmc.example",
  destinationKind: "android_tv",
  exactEpisode: false,
  seriesFallback: false,
  sourceProvider: "watchmode",
  isHomeProvider: true,
};
export const severanceExactEpisode: NormalizedOffer = {
  ...severanceAppleOffer,
  destinationUrl: "https://tv.apple.com/us/episode/example/umc.cmc.episode",
  exactEpisode: true,
};
export const severanceSeriesFallback: NormalizedOffer = {
  ...severanceAppleOffer,
  exactEpisode: false,
  seriesFallback: true,
  seasonNumber: 1,
  episodeNumber: 3,
  destinationKind: "web",
};
export const multiServiceMovie: NormalizedOffer[] = [
  severanceAppleOffer,
  {
    ...severanceAppleOffer,
    providerId: 203,
    providerName: "Netflix",
    destinationUrl: "https://www.netflix.com/title/123",
    isHomeProvider: false,
  },
  {
    ...severanceAppleOffer,
    providerId: 26,
    providerName: "Prime Video",
    destinationUrl: "https://www.amazon.com/gp/video/detail/example",
    type: "rent",
    price: 3.99,
    currency: "USD",
    destinationKind: "web",
    isHomeProvider: false,
  },
  {
    ...severanceAppleOffer,
    providerId: 398,
    providerName: "Peacock",
    destinationUrl: "https://www.peacocktv.com/watch/example",
    type: "ads",
    destinationKind: "web",
    isHomeProvider: false,
  },
  {
    ...severanceAppleOffer,
    providerId: 500,
    providerName: "Cable App",
    destinationUrl: "https://example.com/title",
    type: "tv_everywhere",
    destinationKind: "web",
    isHomeProvider: false,
  },
  {
    ...severanceAppleOffer,
    providerId: 27,
    providerName: "Store",
    destinationUrl: "https://store.example.com/title",
    type: "purchase",
    price: 14.99,
    currency: "USD",
    destinationKind: "web",
    isHomeProvider: false,
  },
];
export const unavailableTitle: NormalizedOffer[] = [];
export const placeholderDeepLink = "Deeplinks available for paid plans only.";
export const upstreamFailures = { rateLimit: 429, serverFailure: 503 };
