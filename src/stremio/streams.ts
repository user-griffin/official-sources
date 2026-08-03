import type { AddonConfig } from "../config/schema.js";
import type { NormalizedOffer, StremioStream } from "../types/models.js";

function money(offer: NormalizedOffer, config: AddonConfig): string {
  if (!config.showPrices || offer.price === undefined) return "";
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: offer.currency ?? "USD",
    }).format(offer.price);
  } catch {
    return `${offer.price.toFixed(2)} ${offer.currency ?? ""}`.trim();
  }
}

function label(offer: NormalizedOffer, config: AddonConfig): string {
  if (offer.seriesFallback) {
    const target =
      offer.seasonNumber !== undefined && offer.episodeNumber !== undefined
        ? `S${offer.seasonNumber}E${offer.episodeNumber}`
        : "the requested episode";
    if (offer.serviceHomeFallback) {
      return `Official service page • Search for the show and choose ${target}`;
    }
    return `Official series page • Choose ${target} in the provider app`;
  }
  const action = offer.destinationKind === "web" ? "Open official website" : "Open official app";
  const home = offer.isHomeProvider ? "Home service • " : "";
  if (offer.exactEpisode) return `${home}Exact episode • ${action}`;
  switch (offer.type) {
    case "subscription":
      return `${home}${config.providers.includes(offer.providerId) ? "Included with your subscription" : "Subscription"} • ${action}`;
    case "free":
      return `${home}Free • ${action}`;
    case "ads":
      return `${home}Free with ads • ${action}`;
    case "tv_everywhere":
      return `${home}TV provider login required`;
    case "rent":
      return [`${home}Rent`, money(offer, config), action].filter(Boolean).join(" • ");
    case "purchase":
      return [`${home}Buy`, money(offer, config), action].filter(Boolean).join(" • ");
  }
}

export function toStremioStreams(offers: NormalizedOffer[], config: AddonConfig): StremioStream[] {
  return offers.flatMap((offer) =>
    offer.destinationUrl
      ? [
          {
            name: `OFFICIAL • ${offer.providerName}`,
            title: label(offer, config),
            ...(offer.quality ? { description: offer.quality } : {}),
            externalUrl: offer.destinationUrl,
            behaviorHints: { notWebReady: true as const },
          },
        ]
      : [],
  );
}
