import { z } from "zod";

const providerIds = z.array(z.number().int().positive().max(10_000_000)).max(100);

export const addonConfigSchema = z
  .object({
    v: z.literal(1),
    country: z.string().regex(/^[A-Z]{2}$/),
    providers: providerIds,
    providerOrder: providerIds,
    selectedFirst: z.boolean(),
    showSubscription: z.boolean(),
    showFree: z.boolean(),
    showAds: z.boolean(),
    showTvEverywhere: z.boolean(),
    showRent: z.boolean(),
    showPurchase: z.boolean(),
    showUnselected: z.boolean(),
    hideInvalidLinks: z.boolean(),
    collapseDuplicates: z.boolean(),
    allowSeriesFallback: z.boolean(),
    showSeriesFallback: z.boolean(),
    showPrices: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.providers).size !== value.providers.length) {
      context.addIssue({
        code: "custom",
        path: ["providers"],
        message: "Provider IDs must be unique",
      });
    }
    if (new Set(value.providerOrder).size !== value.providerOrder.length) {
      context.addIssue({
        code: "custom",
        path: ["providerOrder"],
        message: "Provider order must be unique",
      });
    }
    if (value.providerOrder.some((id) => !value.providers.includes(id))) {
      context.addIssue({
        code: "custom",
        path: ["providerOrder"],
        message: "Order contains an unselected provider",
      });
    }
  });

export type AddonConfig = z.infer<typeof addonConfigSchema>;

export const defaultConfig: AddonConfig = Object.freeze({
  v: 1,
  country: "US",
  providers: [],
  providerOrder: [],
  selectedFirst: true,
  showSubscription: true,
  showFree: true,
  showAds: true,
  showTvEverywhere: false,
  showRent: false,
  showPurchase: false,
  showUnselected: false,
  hideInvalidLinks: true,
  collapseDuplicates: true,
  allowSeriesFallback: true,
  showSeriesFallback: true,
  showPrices: true,
});
