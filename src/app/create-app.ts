import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { AppEnv } from "../config/env.js";
import { decodeConfig, tokenFingerprint } from "../config/token.js";
import type { Logger } from "../logging/logger.js";
import { fallbackProviders } from "../providers/fallback.js";
import type { AvailabilityProvider, RankingEngine } from "../providers/interfaces.js";
import { createManifest } from "../stremio/manifest.js";
import { configurePage, landingPage } from "../web/pages.js";
import { OfficialSourcesService } from "./service.js";

export interface AppDependencies {
  env: AppEnv;
  logger: Logger;
  provider: AvailabilityProvider;
  ranking: RankingEngine;
}

function requestOrigin(request: Request, env: AppEnv): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (env.RAILWAY_PUBLIC_DOMAIN) return `https://${env.RAILWAY_PUBLIC_DOMAIN}`;
  const host = request.get("host") ?? "localhost";
  if (!/^(?:\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(?::\d{1,5})?$/.test(host))
    throw new Error("Invalid host header");
  return `${request.protocol}://${host}`;
}

export function createApp(dependencies: AppDependencies) {
  const { env, logger, provider, ranking } = dependencies;
  const app = express();
  if (env.PUBLIC_BASE_URL || env.RAILWAY_PUBLIC_DOMAIN) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    try {
      requestOrigin(request, env);
      next();
    } catch {
      response.status(400).json({ error: "Invalid host header" });
    }
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use((_request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });
  app.options("*splat", (_request, response) => response.sendStatus(204));
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false, limit: "16kb" }));
  app.use((request, response, next) => {
    const started = performance.now();
    const requestId = randomUUID();
    response.setHeader("X-Request-Id", requestId);
    response.on("finish", () =>
      logger.info("http_request", {
        requestId,
        route: request.path.replace(/\/c\/[^/]+/, "/c/:token"),
        status: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
    next();
  });
  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests" },
  });
  app.use(["/api/providers", "/c/:configToken/stream/:type/:id.json"], limiter);
  app.use(
    "/assets",
    express.static("public", {
      fallthrough: false,
      maxAge: env.NODE_ENV === "production" ? "1h" : 0,
    }),
  );

  app.get("/", (_request, response) => response.type("html").send(landingPage(env)));
  app.get("/configure", (_request, response) => response.type("html").send(configurePage()));
  app.get("/health", (_request, response) =>
    response.json({ status: "ok", service: "official-sources", version: env.APP_VERSION }),
  );
  app.get("/version", (_request, response) =>
    response.json({
      version: env.APP_VERSION,
      commitSha: env.COMMIT_SHA ?? env.RAILWAY_GIT_COMMIT_SHA ?? null,
      buildDate: env.BUILD_DATE ?? null,
      environment: env.NODE_ENV,
    }),
  );
  app.get("/manifest.json", (_request, response) => response.json(createManifest(true)));
  app.get("/api/providers", async (request, response) => {
    const country =
      typeof request.query.country === "string" ? request.query.country.toUpperCase() : "US";
    if (!/^[A-Z]{2}$/.test(country)) return response.status(400).json({ error: "Invalid country" });
    try {
      return response.json({
        country,
        providers: await provider.getProviders(country),
        source: "watchmode",
      });
    } catch (error) {
      logger.warn("provider_catalog_fallback", {
        upstream: "watchmode",
        category: error instanceof Error ? error.name : "unknown",
      });
      return response.json({
        country,
        providers: fallbackProviders.filter((item) => item.regions.includes(country)),
        source: "fallback",
      });
    }
  });
  app.get("/c/:configToken/manifest.json", (request, response) => {
    try {
      decodeConfig(request.params.configToken ?? "");
      return response.json(createManifest(false));
    } catch {
      return response.status(400).json({ error: "Invalid configuration token" });
    }
  });
  const service = new OfficialSourcesService(provider, ranking);
  app.get("/c/:configToken/stream/:type/:id.json", async (request, response) => {
    const token = request.params.configToken ?? "";
    try {
      const config = decodeConfig(token);
      const streams = await service.getStreams(
        request.params.type ?? "",
        request.params.id ?? "",
        config,
      );
      return response.json({ streams });
    } catch (error) {
      if (error instanceof Error && error.name === "ConfigTokenError")
        return response.status(400).json({ streams: [], error: "Invalid configuration" });
      logger.warn("stream_upstream_failure", {
        upstream: "watchmode",
        tokenFingerprint: tokenFingerprint(token),
        category: error instanceof Error ? error.name : "unknown",
      });
      return response.json({ streams: [] });
    }
  });
  app.use((_request, response) => response.status(404).json({ error: "Not found" }));
  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    logger.error("request_error", {
      route: request.path.replace(/\/c\/[^/]+/, "/c/:token"),
      category: error instanceof Error ? error.name : "unknown",
    });
    response.status(500).json({ error: "Internal server error" });
  });
  return app;
}
