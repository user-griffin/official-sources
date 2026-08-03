import { z } from "zod";

export const wmProviderSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    type: z.enum(["sub", "purchase", "free", "tve"]),
    logo_100px: z.string().optional().nullable(),
    regions: z.array(z.string()).default([]),
  })
  .passthrough();
export const wmProvidersSchema = z.array(wmProviderSchema);

export const wmSearchSchema = z
  .object({
    title_results: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            name: z.string(),
            type: z.string(),
            imdb_id: z.string().nullable().optional(),
          })
          .passthrough(),
      )
      .default([]),
    people_results: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const wmSourceSchema = z
  .object({
    source_id: z.number().int().positive(),
    name: z.string().min(1),
    type: z.enum(["sub", "rent", "buy", "free", "tve"]),
    region: z.string(),
    ios_url: z.string().nullable().optional(),
    android_url: z.string().nullable().optional(),
    web_url: z.string().nullable().optional(),
    tvos_url: z.string().nullable().optional(),
    android_tv_url: z.string().nullable().optional(),
    format: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
  })
  .passthrough();
export const wmSourcesSchema = z.array(wmSourceSchema);

export const wmEpisodeSchema = z
  .object({
    id: z.number().int().positive(),
    episode_number: z.number().int(),
    season_number: z.number().int(),
    sources: wmSourcesSchema.optional().default([]),
  })
  .passthrough();
export const wmEpisodesSchema = z.array(wmEpisodeSchema);
