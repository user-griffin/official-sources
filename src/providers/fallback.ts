import type { Provider } from "../types/models.js";

// Graceful-degradation only. Live Watchmode `/sources` is authoritative when configured.
export const fallbackProviders: Provider[] = [
  { id: 371, name: "Apple TV+", type: "subscription", regions: ["US"] },
  { id: 203, name: "Netflix", type: "subscription", regions: ["US"] },
  { id: 26, name: "Amazon Prime", type: "subscription", regions: ["US"] },
  { id: 372, name: "Disney+", type: "subscription", regions: ["US"] },
  { id: 387, name: "Max", type: "subscription", regions: ["US"] },
  { id: 398, name: "Peacock", type: "subscription", regions: ["US"] },
];
