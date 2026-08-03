import type { AvailabilityProvider } from "../../src/providers/interfaces.js";
import type {
  MediaTitleId,
  NormalizedOffer,
  Provider,
  ResolvedTitle,
} from "../../src/types/models.js";
import { severanceAppleOffer, severanceExactEpisode, severanceSeriesFallback } from "./offers.js";

export class MockAvailabilityProvider implements AvailabilityProvider {
  movieOffers: NormalizedOffer[] = [severanceAppleOffer];
  episodeOffers: NormalizedOffer[] = [severanceExactEpisode];
  failure: Error | null = null;
  providers: Provider[] = [{ id: 371, name: "Apple TV+", type: "subscription", regions: ["US"] }];
  title: ResolvedTitle | null = {
    id: "123",
    externalId: { scheme: "imdb", value: "tt11280740", mediaType: "series" },
    imdbId: "tt11280740",
    name: "Severance",
    type: "series",
    homeProviderNames: ["Apple TV+"],
  };
  getProviders(): Promise<Provider[]> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.providers);
  }
  resolveTitleByImdb(): Promise<ResolvedTitle | null> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.title);
  }
  resolveTitleById(_titleId: MediaTitleId): Promise<ResolvedTitle | null> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.title);
  }
  getMovieOffers(): Promise<NormalizedOffer[]> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.movieOffers);
  }
  getEpisodeOffers(): Promise<NormalizedOffer[]> {
    return this.failure ? Promise.reject(this.failure) : Promise.resolve(this.episodeOffers);
  }
  useSeriesFallback(): void {
    this.episodeOffers = [severanceSeriesFallback];
  }
}
