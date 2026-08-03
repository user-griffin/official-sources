import type { AddonConfig } from "../config/schema.js";
import type { RankingEngine } from "../providers/interfaces.js";
import type { NormalizedOffer, OfferType } from "../types/models.js";

function enabled(type: OfferType, config: AddonConfig): boolean {
  return {
    subscription: config.showSubscription,
    free: config.showFree,
    ads: config.showAds,
    tv_everywhere: config.showTvEverywhere,
    rent: config.showRent,
    purchase: config.showPurchase,
  }[type];
}

export function filterOffers(offers: NormalizedOffer[], config: AddonConfig): NormalizedOffer[] {
  const selected = new Set(config.providers);
  const filtered = offers.filter((offer) => {
    if (!enabled(offer.type, config)) return false;
    if (offer.type === "subscription" && !selected.has(offer.providerId) && !config.showUnselected)
      return false;
    if (!offer.destinationUrl && config.hideInvalidLinks) return false;
    if (offer.seriesFallback && (!config.allowSeriesFallback || !config.showSeriesFallback))
      return false;
    return true;
  });
  if (!config.collapseDuplicates) return filtered;
  const exactSeen = new Set<string>();
  const contentSeen = new Map<string, number>();
  const collapsed: NormalizedOffer[] = [];
  for (const offer of filtered) {
    const exactKey = [
      offer.providerId,
      offer.type,
      offer.price ?? "",
      offer.currency ?? "",
      offer.destinationUrl ?? "",
      offer.exactEpisode,
      offer.seriesFallback,
      offer.quality ?? "",
    ].join("|");
    if (exactSeen.has(exactKey)) continue;
    exactSeen.add(exactKey);
    if (offer.destinationUrl && offer.type !== "rent" && offer.type !== "purchase") {
      const contentKey = [offer.destinationUrl, offer.exactEpisode, offer.seriesFallback].join("|");
      const existingIndex = contentSeen.get(contentKey);
      if (existingIndex !== undefined) {
        const existing = collapsed[existingIndex];
        if (existing && existing.providerId !== offer.providerId) {
          const preference = (item: NormalizedOffer): number =>
            Number(item.isHomeProvider) * 2 + Number(selected.has(item.providerId));
          if (preference(offer) > preference(existing)) collapsed[existingIndex] = offer;
          continue;
        }
      } else contentSeen.set(contentKey, collapsed.length);
    }
    collapsed.push(offer);
  }
  return collapsed;
}

const offerRank: Record<OfferType, number> = {
  subscription: 0,
  free: 1,
  ads: 2,
  tv_everywhere: 3,
  rent: 4,
  purchase: 5,
};
const destinationRank = { android_tv: 0, android: 1, app_link: 2, web: 3 } as const;

export class DeterministicRankingEngine implements RankingEngine {
  rank(offers: NormalizedOffer[], config: AddonConfig): NormalizedOffer[] {
    const priorities = new Map(config.providerOrder.map((id, index) => [id, index]));
    const selected = new Set(config.providers);
    return offers
      .map((offer, index) => ({ offer, index }))
      .sort((a, b) => {
        const home = Number(!a.offer.isHomeProvider) - Number(!b.offer.isHomeProvider);
        const aSelected = selected.has(a.offer.providerId) ? 0 : 1;
        const bSelected = selected.has(b.offer.providerId) ? 0 : 1;
        const selection = config.selectedFirst ? aSelected - bSelected : 0;
        const type = offerRank[a.offer.type] - offerRank[b.offer.type];
        const provider =
          (priorities.get(a.offer.providerId) ?? 10_000) -
          (priorities.get(b.offer.providerId) ?? 10_000);
        const exact = Number(a.offer.seriesFallback) - Number(b.offer.seriesFallback);
        const destination =
          (a.offer.destinationKind ? destinationRank[a.offer.destinationKind] : 9) -
          (b.offer.destinationKind ? destinationRank[b.offer.destinationKind] : 9);
        const metadata = Number(!a.offer.providerLogoUrl) - Number(!b.offer.providerLogoUrl);
        const price =
          (a.offer.type === "rent" || a.offer.type === "purchase") && a.offer.type === b.offer.type
            ? (a.offer.price ?? Infinity) - (b.offer.price ?? Infinity)
            : 0;
        return (
          home ||
          selection ||
          type ||
          provider ||
          exact ||
          destination ||
          metadata ||
          price ||
          a.index - b.index
        );
      })
      .map(({ offer }) => offer);
  }
}
