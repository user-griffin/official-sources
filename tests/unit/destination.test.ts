import { describe, expect, it } from "vitest";
import {
  canonicalTitleDestination,
  isSafeDestination,
  isTitleLevelDestination,
  SafeDestinationResolver,
} from "../../src/security/destination.js";
import { placeholderDeepLink } from "../fixtures/offers.js";

describe("destination security", () => {
  it("accepts HTTPS", () =>
    expect(isSafeDestination("https://tv.apple.com/show/example")).toBe(true));
  it.each([
    "javascript:alert(1)",
    "http://example.com",
    "https://localhost/title",
    "https://127.0.0.1/title",
    "https://[::1]/title",
    "https://[::ffff:127.0.0.1]/title",
    "https://10.0.0.1/title",
    "not a url",
    "https://user:pass@example.com/title",
    "https://metadata.google.internal/latest",
    "https://google.com/url?q=x",
    placeholderDeepLink,
  ])("rejects %s", (url) => expect(isSafeDestination(url)).toBe(false));
  it("prefers Android TV, then Android, then web", () =>
    expect(
      new SafeDestinationResolver().resolve({
        web: "https://example.com/web",
        android: "https://example.com/android",
        android_tv: "https://example.com/tv",
      })?.kind,
    ).toBe("android_tv"));
  it("rejects unverified application schemes", () =>
    expect(isSafeDestination("netflix://title/123")).toBe(false));
  it.each([
    "https://tv.apple.com/us/show/severance/umc.cmc.1srk2goyh2q2zdxcx605w8vtx",
    "https://www.netflix.com/title/81280926",
    "https://www.netflix.com/watch/81280926",
    "https://www.amazon.com/gp/video/detail/B0CXGJ7Y7F",
    "https://watch.amazon.com/detail?gti=amzn1.dv.gti.9ab600aa-6625-b547-cfc0-190e3ad8a27d",
    "https://www.disneyplus.com/series/loki/6pARMvILBGzF",
    "https://play.hbomax.com/video/watch/dae9e532-3714-4f2e-b758-fb9a13def902",
    "https://www.hulu.com/series/example-8f40d0d4-0020-4c27",
    "https://www.peacocktv.com/watch/asset/tv/example/123",
    "https://www.paramountplus.com/shows/example/",
    "https://tubitv.com/series/300012345/example",
    "https://pluto.tv/us/on-demand/series/example/details",
  ])("accepts content-level service URL %s", (url) =>
    expect(isTitleLevelDestination(url)).toBe(true),
  );
  it.each([
    "https://tv.apple.com/",
    "https://www.netflix.com/browse",
    "https://www.amazon.com/gp/video/",
    "https://www.disneyplus.com/home",
    "https://www.max.com/",
    "https://www.hulu.com/hub/home",
    "https://www.peacocktv.com/watch/home",
    "https://www.paramountplus.com/shows/",
    "https://tubitv.com/home",
    "https://pluto.tv/us/on-demand",
  ])("rejects service landing URL %s", (url) => expect(isTitleLevelDestination(url)).toBe(false));
  it("canonicalizes an Apple episode URL to its show ID", () =>
    expect(
      canonicalTitleDestination(
        "https://tv.apple.com/us/episode/sweet-vitriol/umc.cmc.episode?showId=umc.cmc.1srk2goyh2q2zdxcx605w8vtx",
      ),
    ).toBe("https://tv.apple.com/show/umc.cmc.1srk2goyh2q2zdxcx605w8vtx"));
  it("canonicalizes a Peacock episode URL to its series page", () =>
    expect(
      canonicalTitleDestination(
        "https://www.peacocktv.com/watch/asset/tv/poker-face/9091855651030489112/seasons/1/episodes/rest-in-metal-episode-4/episode-id",
      ),
    ).toBe("https://www.peacocktv.com/watch/asset/tv/poker-face/9091855651030489112"));
});
