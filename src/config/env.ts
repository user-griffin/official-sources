import { z } from "zod";

const optionalUrl = z
  .string()
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(7000),
  WATCHMODE_API_KEY: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  PUBLIC_BASE_URL: optionalUrl,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5000),
  WATCHMODE_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  CACHE_PROVIDER_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(86_400),
  CACHE_TITLE_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(604_800),
  CACHE_SOURCE_TTL_SECONDS: z.coerce.number().int().min(60).max(2_592_000).default(21_600),
  CACHE_NEGATIVE_TTL_SECONDS: z.coerce.number().int().min(30).max(86_400).default(900),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).default(120),
  GITHUB_REPOSITORY_URL: optionalUrl,
  APP_VERSION: z.string().default("1.0.0"),
  COMMIT_SHA: z
    .string()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  BUILD_DATE: z
    .string()
    .max(100)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  RAILWAY_PUBLIC_DOMAIN: z.string().max(253).optional(),
  RAILWAY_GIT_COMMIT_SHA: z.string().max(100).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}
