import { describe, expect, it } from "vitest";
import { addonConfigSchema, defaultConfig } from "../../src/config/schema.js";
import { decodeConfig, encodeConfig, MAX_CONFIG_TOKEN_LENGTH } from "../../src/config/token.js";

describe("configuration tokens", () => {
  it("encodes, decodes, and round trips defaults", () =>
    expect(decodeConfig(encodeConfig(defaultConfig))).toEqual(defaultConfig));
  it("round trips selected providers", () => {
    const config = { ...defaultConfig, providers: [371, 203], providerOrder: [203, 371] };
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
  });
  it("rejects unsupported versions", () =>
    expect(() =>
      decodeConfig(Buffer.from(JSON.stringify({ ...defaultConfig, v: 3 })).toString("base64url")),
    ).toThrow(/Unsupported/));
  it("migrates Apple-only v1 installs to broad official-source discovery", () => {
    const legacy = {
      ...defaultConfig,
      v: 1,
      providers: [371],
      providerOrder: [371],
      showTvEverywhere: false,
      showRent: false,
      showPurchase: false,
      showUnselected: false,
    };
    const migrated = decodeConfig(Buffer.from(JSON.stringify(legacy)).toString("base64url"));
    expect(migrated).toMatchObject({
      v: 2,
      providers: [],
      providerOrder: [],
      showTvEverywhere: true,
      showRent: true,
      showPurchase: true,
      showUnselected: true,
    });
  });
  it("rejects malformed and oversized tokens", () => {
    expect(() => decodeConfig("not*base64")).toThrow();
    expect(() => decodeConfig("a".repeat(MAX_CONFIG_TOKEN_LENGTH + 1))).toThrow();
  });
  it("rejects invalid countries, provider IDs, extras and lists", () => {
    expect(addonConfigSchema.safeParse({ ...defaultConfig, country: "USA" }).success).toBe(false);
    expect(addonConfigSchema.safeParse({ ...defaultConfig, providers: [-1] }).success).toBe(false);
    expect(addonConfigSchema.safeParse({ ...defaultConfig, extra: true }).success).toBe(false);
    expect(
      addonConfigSchema.safeParse({
        ...defaultConfig,
        providers: Array.from({ length: 251 }, (_, index) => index + 1),
      }).success,
    ).toBe(false);
  });
});
