import { z } from "zod";

const providerIds = z.array(z.number().int().positive().max(10_000_000)).max(250);

const configShape = {
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
};

function validateProviderLists(
  value: { providers: number[]; providerOrder: number[] },
  context: z.RefinementCtx,
): void {
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
}

export const legacyAddonConfigSchema = z
  .object({ v: z.literal(1), ...configShape })
  .strict()
  .superRefine(validateProviderLists);

export const addonConfigSchema = z
  .object({ v: z.literal(2), ...configShape })
  .strict()
  .superRefine(validateProviderLists);

export type AddonConfig = z.infer<typeof addonConfigSchema>;

export const defaultConfig: AddonConfig = Object.freeze({
  v: 2,
  country: "US",
  providers: [],
  providerOrder: [],
  selectedFirst: true,
  showSubscription: true,
  showFree: true,
  showAds: true,
  showTvEverywhere: true,
  showRent: true,
  showPurchase: true,
  showUnselected: true,
  hideInvalidLinks: true,
  collapseDuplicates: true,
  allowSeriesFallback: true,
  showSeriesFallback: true,
  showPrices: true,
});
