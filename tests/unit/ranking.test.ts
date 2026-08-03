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
    const unselected = {
      ...severanceAppleOffer,
      providerId: 999,
      providerName: "Other",
      isHomeProvider: false,
    };
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
  it("honors provider priority among non-home services", () =>
    expect(
      engine.rank(
        multiServiceMovie.slice(0, 2).map((offer) => ({ ...offer, isHomeProvider: false })),
        config,
      )[0]?.providerId,
    ).toBe(203));
  it("always places a detected home service before a selected provider", () => {
    const selectedApple = { ...severanceAppleOffer, isHomeProvider: false };
    const homeNetflix = { ...multiServiceMovie[1]!, isHomeProvider: true };
    expect(engine.rank([selectedApple, homeNetflix], config)[0]?.providerId).toBe(203);
  });
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
        [
          { ...severanceSeriesFallback, isHomeProvider: false },
          { ...severanceAppleOffer, exactEpisode: true },
        ],
        config,
      )[0]?.exactEpisode,
    ).toBe(true));
  it("collapses exact duplicates but retains materially distinct offers", () => {
    expect(filterOffers([severanceAppleOffer, severanceAppleOffer], config)).toHaveLength(1);
    expect(
      filterOffers([severanceAppleOffer, { ...severanceAppleOffer, type: "free" }], config),
    ).toHaveLength(2);
  });
  it("collapses different provider labels that open the same non-purchase destination", () => {
    expect(
      filterOffers(
        [
          severanceAppleOffer,
          { ...severanceAppleOffer, providerId: 999, providerName: "Channel variant" },
        ],
        config,
      ),
    ).toEqual([severanceAppleOffer]);
  });
  it("keeps a selected service label when a free provider shares its destination", () => {
    const free = {
      ...severanceAppleOffer,
      providerId: 999,
      providerName: "Free channel",
      type: "free" as const,
      isHomeProvider: false,
    };
    expect(filterOffers([free, severanceAppleOffer], config)).toEqual([severanceAppleOffer]);
  });
  it("hides unselected subscriptions but keeps global free sources", () => {
    const unselectedSubscription = {
      ...severanceAppleOffer,
      providerId: 999,
      isHomeProvider: false,
    };
    const freeSource = {
      ...severanceAppleOffer,
      providerId: 998,
      type: "free" as const,
      isHomeProvider: false,
    };
    expect(
      filterOffers([unselectedSubscription, freeSource], {
        ...defaultConfig,
        providers: [371],
        providerOrder: [371],
        showUnselected: false,
      }),
    ).toEqual([freeSource]);
  });
  it("is stable and deterministic", () =>
    expect(engine.rank([severanceAppleOffer, { ...severanceAppleOffer }], config)).toEqual([
      severanceAppleOffer,
      severanceAppleOffer,
    ]));
});
