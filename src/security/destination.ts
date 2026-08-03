import { isIP } from "node:net";
import type { DestinationUrlResolver } from "../providers/interfaces.js";
import type { DestinationKind } from "../types/models.js";

const placeholders =
  /deeplinks? available|episode links? available|paid plans? only|upgrade your plan|^n\/?a$|^null$|^undefined$/i;
const redirectHosts = new Set(["google.com", "www.google.com", "l.facebook.com", "t.co"]);

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
