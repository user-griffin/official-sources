import { describe, expect, it } from "vitest";
import { parseMediaId } from "../../src/stremio/media-id.js";

describe("media ID parser", () => {
  it("parses IMDb movies", () =>
    expect(parseMediaId("movie", "tt1234567")).toEqual({
      kind: "movie",
      titleId: { scheme: "imdb", value: "tt1234567", mediaType: "movie" },
    }));
  it("parses IMDb episodes", () =>
    expect(parseMediaId("series", "tt11280740:1:3")).toEqual({
      kind: "episode",
      titleId: { scheme: "imdb", value: "tt11280740", mediaType: "series" },
      season: 1,
      episode: 3,
    }));
  it("parses TMDB movies and episodes", () => {
    expect(parseMediaId("movie", "tmdb:550")).toEqual({
      kind: "movie",
      titleId: { scheme: "tmdb", value: 550, mediaType: "movie" },
    });
    expect(parseMediaId("series", "tmdb:95396:2:4")).toEqual({
      kind: "episode",
      titleId: { scheme: "tmdb", value: 95396, mediaType: "series" },
      season: 2,
      episode: 4,
    });
  });
  it("accepts season zero specials, including anime specials", () =>
    expect(parseMediaId("series", "tmdb:95396:0:1")).toEqual({
      kind: "episode",
      titleId: { scheme: "tmdb", value: 95396, mediaType: "series" },
      season: 0,
      episode: 1,
    }));
  it.each([
    ["movie", "123"],
    ["series", "tt1234567:1:0"],
    ["series", "tt1234567:one:2"],
    ["other", "tt1234567"],
  ])("rejects %s/%s", (type, id) => expect(parseMediaId(type, id)).toBeNull());
});
