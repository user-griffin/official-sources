import { createHash } from "node:crypto";
import { addonConfigSchema, type AddonConfig } from "./schema.js";

export const MAX_CONFIG_TOKEN_LENGTH = 4096;

export class ConfigTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigTokenError";
  }
}

export function encodeConfig(config: AddonConfig): string {
  const validated = addonConfigSchema.parse(config);
  return Buffer.from(JSON.stringify(validated), "utf8").toString("base64url");
}

export function decodeConfig(token: string): AddonConfig {
  if (!token || token.length > MAX_CONFIG_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new ConfigTokenError("Malformed or oversized configuration token");
  }
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    if (Buffer.byteLength(raw) > 8192) throw new Error("decoded token too large");
    const unknownPayload: unknown = JSON.parse(raw);
    if (
      typeof unknownPayload === "object" &&
      unknownPayload !== null &&
      "v" in unknownPayload &&
      unknownPayload.v !== 1
    ) {
      throw new ConfigTokenError("Unsupported configuration version");
    }
    return addonConfigSchema.parse(unknownPayload);
  } catch (error) {
    if (error instanceof ConfigTokenError) throw error;
    throw new ConfigTokenError("Invalid configuration token");
  }
}

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 10);
}
