import type { AddonConfig } from "../config/schema.js";
import type { AvailabilityProvider, RankingEngine } from "../providers/interfaces.js";
import { filterOffers } from "../ranking/engine.js";
import { parseMediaId } from "../stremio/media-id.js";
import { toStremioStreams } from "../stremio/streams.js";
import type { StremioStream } from "../types/models.js";

export class OfficialSourcesService {
  constructor(
    private readonly provider: AvailabilityProvider,
    private readonly ranking: RankingEngine,
  ) {}

  async getStreams(type: string, id: string, config: AddonConfig): Promise<StremioStream[]> {
    const media = parseMediaId(type, id);
    if (!media) return [];
    const title = await this.provider.resolveTitleByImdb(media.imdbId);
    if (!title) return [];
    const offers =
      media.kind === "movie"
        ? await this.provider.getMovieOffers(title.id, config.country)
        : await this.provider.getEpisodeOffers(
            title.id,
            media.season,
            media.episode,
            config.country,
          );
    return toStremioStreams(this.ranking.rank(filterOffers(offers, config), config), config);
  }
}
