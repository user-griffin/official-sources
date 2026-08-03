import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app/create-app.js";
import { defaultConfig } from "../../src/config/schema.js";
import { loadEnv } from "../../src/config/env.js";
import { encodeConfig } from "../../src/config/token.js";
import { silentLogger } from "../../src/logging/logger.js";
import { DeterministicRankingEngine } from "../../src/ranking/engine.js";
import { MockAvailabilityProvider } from "../fixtures/mock-provider.js";

function setup(provider = new MockAvailabilityProvider(), max = "1000") {
  const env = loadEnv({
    NODE_ENV: "test",
    RATE_LIMIT_MAX: max,
    GITHUB_REPOSITORY_URL: "https://github.com/example/official-sources",
  });
  return {
    app: createApp({
      env,
      logger: silentLogger,
      provider,
      ranking: new DeterministicRankingEngine(),
    }),
    provider,
  };
}
const configured = (overrides = {}) =>
  encodeConfig({ ...defaultConfig, providers: [371], providerOrder: [371], ...overrides });

describe("HTTP routes", () => {
  it("serves root, configure, health and version", async () => {
    const { app } = setup();
    expect((await request(app).get("/")).text).toContain("Official Sources");
    expect((await request(app).get("/configure")).text).toContain("Build your source lineup");
    expect((await request(app).get("/health")).body).toEqual({
      status: "ok",
      service: "official-sources",
      version: "1.0.0",
    });
    expect((await request(app).get("/version")).body).toMatchObject({
      version: "1.0.0",
      environment: "test",
    });
  });
  it("returns provider data without secrets", async () => {
    const response = await request(setup().app).get("/api/providers?country=US");
    expect(response.body.providers[0].name).toBe("Apple TV+");
    expect(JSON.stringify(response.body)).not.toContain("API_KEY");
  });
  it("serves valid unconfigured and configured manifests", async () => {
    const { app } = setup();
    expect((await request(app).get("/manifest.json")).body).toMatchObject({
      id: "com.officialsources.nuvio",
      name: "Official Sources",
    });
    expect(
      (await request(app).get(`/c/${configured()}/manifest.json`)).body.behaviorHints
        .configurationRequired,
    ).toBe(false);
    expect((await request(app).get("/c/bad/manifest.json")).status).toBe(400);
  });
  it("returns movie and exact episode external URLs", async () => {
    const { app } = setup();
    const token = configured();
    const movie = await request(app).get(`/c/${token}/stream/movie/tt1234567.json`);
    expect(movie.body.streams[0]).toMatchObject({
      name: "OFFICIAL • Apple TV+",
      externalUrl: expect.stringContaining("tv.apple.com"),
    });
    const episode = await request(app).get(`/c/${token}/stream/series/tt11280740:1:3.json`);
    expect(episode.body.streams[0].title).toContain("Exact episode");
  });
  it("labels series fallback and hides it when disabled", async () => {
    const setupResult = setup();
    setupResult.provider.useSeriesFallback();
    expect(
      (await request(setupResult.app).get(`/c/${configured()}/stream/series/tt11280740:1:3.json`))
        .body.streams[0].title,
    ).toContain("Series page fallback");
    expect(
      (
        await request(setupResult.app).get(
          `/c/${configured({ showSeriesFallback: false })}/stream/series/tt11280740:1:3.json`,
        )
      ).body.streams,
    ).toEqual([]);
  });
  it("returns empty streams for invalid IDs and upstream failure", async () => {
    const setupResult = setup();
    const token = configured();
    expect((await request(setupResult.app).get(`/c/${token}/stream/movie/nope.json`)).body).toEqual(
      { streams: [] },
    );
    setupResult.provider.failure = new Error("upstream body with secret details");
    expect(
      (await request(setupResult.app).get(`/c/${token}/stream/movie/tt1234567.json`)).body,
    ).toEqual({ streams: [] });
  });
  it("sets CORS/security headers and enforces rate limiting", async () => {
    const { app } = setup(undefined, "10");
    const first = await request(app).get("/api/providers").set("Origin", "https://app.strem.io");
    expect(first.headers["access-control-allow-origin"]).toBe("*");
    expect(first.headers["content-security-policy"]).toContain("default-src 'self'");
    let last = first;
    for (let index = 0; index < 10; index += 1) last = await request(app).get("/api/providers");
    expect(last.status).toBe(429);
  });
});
