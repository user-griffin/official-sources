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
  if (offer.seriesFallback) return "Series page fallback • Exact episode link unavailable";
  const action = offer.destinationKind === "web" ? "Open official website" : "Open official app";
  if (offer.exactEpisode) return `Exact episode • ${action}`;
  switch (offer.type) {
    case "subscription":
      return `Included with your subscription • ${action}`;
    case "free":
      return `Free • ${action}`;
    case "ads":
      return `Free with ads • ${action}`;
    case "tv_everywhere":
      return "TV provider login required";
    case "rent":
      return ["Rent", money(offer, config), action].filter(Boolean).join(" • ");
    case "purchase":
      return ["Buy", money(offer, config), action].filter(Boolean).join(" • ");
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
