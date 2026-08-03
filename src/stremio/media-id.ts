import type { ParsedMediaId } from "../types/models.js";

const moviePattern = /^(tt\d{7,10})$/;
const episodePattern = /^(tt\d{7,10}):(\d{1,3}):(\d{1,4})$/;

export function parseMediaId(type: string, id: string): ParsedMediaId | null {
  if (type === "movie") {
    const match = moviePattern.exec(id);
    return match?.[1] ? { kind: "movie", imdbId: match[1] } : null;
  }
  if (type === "series") {
    const match = episodePattern.exec(id);
    if (!match?.[1] || !match[2] || !match[3]) return null;
    const season = Number(match[2]);
    const episode = Number(match[3]);
    if (season < 1 || episode < 1) return null;
    return { kind: "episode", imdbId: match[1], season, episode };
  }
  return null;
}
