import type { ParsedMediaId } from "../types/models.js";

const moviePattern = /^(tt\d{7,10})$/;
const episodePattern = /^(tt\d{7,10}):(\d{1,3}):(\d{1,4})$/;
const tmdbMoviePattern = /^tmdb:(\d{1,10})$/;
const tmdbEpisodePattern = /^tmdb:(\d{1,10}):(\d{1,3}):(\d{1,4})$/;

export function parseMediaId(type: string, id: string): ParsedMediaId | null {
  if (type === "movie") {
    const match = moviePattern.exec(id);
    if (match?.[1]) {
      return {
        kind: "movie",
        titleId: { scheme: "imdb", value: match[1], mediaType: "movie" },
      };
    }
    const tmdbMatch = tmdbMoviePattern.exec(id);
    const value = tmdbMatch?.[1] ? Number(tmdbMatch[1]) : 0;
    return value > 0
      ? { kind: "movie", titleId: { scheme: "tmdb", value, mediaType: "movie" } }
      : null;
  }
  if (type === "series") {
    const match = episodePattern.exec(id);
    const tmdbMatch = tmdbEpisodePattern.exec(id);
    const titleId = match?.[1]
      ? { scheme: "imdb" as const, value: match[1], mediaType: "series" as const }
      : tmdbMatch?.[1]
        ? { scheme: "tmdb" as const, value: Number(tmdbMatch[1]), mediaType: "series" as const }
        : null;
    const season = Number(match?.[2] ?? tmdbMatch?.[2]);
    const episode = Number(match?.[3] ?? tmdbMatch?.[3]);
    if (!titleId) return null;
    if (season < 0 || episode < 1) return null;
    return { kind: "episode", titleId, season, episode };
  }
  return null;
}
