import { describe, expect, it } from "vitest";
import { parseMediaId } from "../../src/stremio/media-id.js";

describe("media ID parser", () => {
  it("parses IMDb movies", () =>
    expect(parseMediaId("movie", "tt1234567")).toEqual({ kind: "movie", imdbId: "tt1234567" }));
  it("parses IMDb episodes", () =>
    expect(parseMediaId("series", "tt11280740:1:3")).toEqual({
      kind: "episode",
      imdbId: "tt11280740",
      season: 1,
      episode: 3,
    }));
  it.each([
    ["movie", "123"],
    ["series", "tt1234567:0:1"],
    ["series", "tt1234567:1:0"],
    ["series", "tt1234567:one:2"],
    ["other", "tt1234567"],
  ])("rejects %s/%s", (type, id) => expect(parseMediaId(type, id)).toBeNull());
});
