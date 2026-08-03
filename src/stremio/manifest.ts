import { addonBuilder, type Manifest } from "stremio-addon-sdk";

export const APP_VERSION = "1.1.0";

function rawManifest(configurationRequired: boolean): Manifest {
  return {
    id: "com.officialsources.nuvio",
    version: APP_VERSION,
    name: "Official Sources",
    description:
      "Opens legitimate streaming-provider applications and websites. Independent and unofficial.",
    resources: [{ name: "stream", types: ["movie", "series"], idPrefixes: ["tt", "tmdb:"] }],
    types: ["movie", "series"],
    catalogs: [],
    idPrefixes: ["tt", "tmdb:"],
    behaviorHints: { configurable: true, configurationRequired },
  };
}

export function createManifest(configurationRequired: boolean): Manifest {
  const manifest = rawManifest(configurationRequired);
  // The SDK validates the same core shape clients consume. Dynamic configuration lives in the URL.
  new addonBuilder(manifest);
  return manifest;
}
