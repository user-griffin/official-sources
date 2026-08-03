import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/config/schema.js";
import { DeterministicRankingEngine, filterOffers } from "../../src/ranking/engine.js";
import type { NormalizedOffer } from "../../src/types/models.js";
import {
  multiServiceMovie,
  severanceAppleOffer,
  severanceSeriesFallback,
} from "../fixtures/offers.js";

const engine = new DeterministicRankingEngine();
const config = {
  ...defaultConfig,
  providers: [371, 203, 26, 27, 398, 500],
  providerOrder: [203, 371, 26, 27, 398, 500],
  showRent: true,
  showPurchase: true,
  showTvEverywhere: true,
};

describe("filtering and ranking", () => {
  it("places selected before unselected and subscription/free before rental", () => {
    const unselected = { ...severanceAppleOffer, providerId: 999, providerName: "Other" };
    const ranked = engine.rank([unselected, ...multiServiceMovie], {
      ...config,
      showUnselected: true,
    });
    expect(ranked.at(-1)?.providerId).toBe(999);
    expect(ranked.findIndex((item) => item.type === "subscription")).toBeLessThan(
      ranked.findIndex((item) => item.type === "rent"),
    );
    expect(ranked.findIndex((item) => item.type === "ads")).toBeLessThan(
      ranked.findIndex((item) => item.type === "rent"),
    );
  });
  it("honors provider priority", () =>
    expect(engine.rank(multiServiceMovie.slice(0, 2), config)[0]?.providerId).toBe(203));
  it("orders rental and purchase prices lowest first", () => {
    for (const type of ["rent", "purchase"] as const) {
      const offers: NormalizedOffer[] = [5.99, 2.99].map((price, index) => ({
        ...severanceAppleOffer,
        providerId: 800 + index,
        type,
        price,
      }));
      expect(
        engine
          .rank(offers, { ...config, providers: [800, 801], providerOrder: [] })
          .map((item) => item.price),
      ).toEqual([2.99, 5.99]);
    }
  });
  it("prefers exact episode over fallback", () =>
    expect(
      engine.rank(
        [severanceSeriesFallback, { ...severanceAppleOffer, exactEpisode: true }],
        config,
      )[0]?.exactEpisode,
    ).toBe(true));
  it("collapses exact duplicates but retains materially distinct offers", () => {
    expect(filterOffers([severanceAppleOffer, severanceAppleOffer], config)).toHaveLength(1);
    expect(
      filterOffers([severanceAppleOffer, { ...severanceAppleOffer, type: "free" }], config),
    ).toHaveLength(2);
  });
  it("is stable and deterministic", () =>
    expect(engine.rank([severanceAppleOffer, { ...severanceAppleOffer }], config)).toEqual([
      severanceAppleOffer,
      severanceAppleOffer,
    ]));
});
