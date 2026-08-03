import { isIP } from "node:net";
import type { DestinationUrlResolver } from "../providers/interfaces.js";
import type { DestinationKind } from "../types/models.js";

const placeholders =
  /deeplinks? available|episode links? available|paid plans? only|upgrade your plan|^n\/?a$|^null$|^undefined$/i;
const redirectHosts = new Set(["google.com", "www.google.com", "l.facebook.com", "t.co"]);
const genericLandingPaths = new Set([
  "",
  "home",
  "browse",
  "search",
  "signin",
  "sign-in",
  "login",
  "signup",
  "sign-up",
  "movies",
  "shows",
  "series",
  "tv",
  "watch",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return false;
  const [a = 0, b = 0] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

export function isSafeDestination(value: string | undefined): value is string {
  const hasControlCharacter = value
    ? [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })
    : false;
  if (!value || value.length > 2048 || placeholders.test(value.trim()) || hasControlCharacter)
    return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return false;
  const host = url.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "metadata.google.internal" ||
    redirectHosts.has(host)
  )
    return false;
  if (isIP(host) === 4 && isPrivateIpv4(host)) return false;
  if (
    isIP(host) === 6 &&
    (host === "::1" ||
      host.startsWith("::ffff:") ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80:"))
  )
    return false;
  return true;
}

export function canonicalTitleDestination(value: string): string {
  if (!isSafeDestination(value)) return value;
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "tv.apple.com" && /(?:^|\/)episode\//i.test(url.pathname)) {
    const showId = url.searchParams.get("showId");
    if (showId && /^umc\.cmc\.[a-z0-9]+$/i.test(showId))
      return `${url.origin}/show/${encodeURIComponent(showId)}`;
  }
  if (host.endsWith("peacocktv.com")) {
    const series = url.pathname.match(/^(\/watch\/asset\/tv\/[^/]+\/[^/]+)(?:\/seasons\/.*)?$/i);
    if (series?.[1]) return `${url.origin}${series[1]}`;
  }
  return value;
}

export function isTitleLevelDestination(value: string, _providerName = ""): boolean {
  if (!isSafeDestination(value)) return false;
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/^\/+|\/+$/g, "");
  const segments = path.split("/").filter(Boolean);
  if (
    !segments.length ||
    genericLandingPaths.has(path.toLowerCase()) ||
    genericLandingPaths.has(segments.at(-1)!.toLowerCase())
  )
    return false;

  if (host === "tv.apple.com")
    return /(?:^|\/)(?:show|movie|episode)\//i.test(path) && /umc\.cmc\./i.test(path);
  if (host.endsWith("netflix.com")) return /(?:^|\/)(?:title|watch)\/\d+/i.test(path);
  if (host.endsWith("amazon.com") || host === "watch.amazon.com" || host.endsWith("primevideo.com"))
    return (
      /(?:^|\/)(?:gp\/video\/detail|detail)\/[^/]+/i.test(path) ||
      (path.toLowerCase() === "detail" &&
        /^amzn1\.dv\.gti\./i.test(url.searchParams.get("gti") ?? ""))
    );
  if (host.endsWith("disneyplus.com"))
    return /(?:^|\/)(?:browse\/entity-|movies\/[^/]+\/|series\/[^/]+\/)[^/]+/i.test(path);
  if (host.endsWith("max.com") || host.endsWith("hbomax.com"))
    return /(?:^|\/)(?:shows|movies|video\/watch)\/[^/]+/i.test(path);
  if (host.endsWith("hulu.com")) return /(?:^|\/)(?:movie|series|watch)\/[^/]+/i.test(path);
  if (host.endsWith("peacocktv.com"))
    return /(?:^|\/)(?:watch|stream-tv|stream-movies)\/[^/]+/i.test(path);
  if (host.endsWith("paramountplus.com")) return /(?:^|\/)(?:shows|movies)\/[^/]+/i.test(path);
  if (host.endsWith("tubitv.com")) return /(?:^|\/)(?:movies|tv-shows|series)\/[^/]+/i.test(path);
  if (host.endsWith("pluto.tv")) return /(?:^|\/)on-demand\/[^/]+/i.test(path);

  return !genericLandingPaths.has(segments[0]!.toLowerCase());
}

export class SafeDestinationResolver implements DestinationUrlResolver {
  resolve(candidates: Partial<Record<DestinationKind, string>>) {
    const order: DestinationKind[] = ["android_tv", "android", "app_link", "web"];
    for (const kind of order) {
      const candidate = candidates[kind];
      if (isSafeDestination(candidate)) return { url: candidate, kind };
    }
    return undefined;
  }
}
