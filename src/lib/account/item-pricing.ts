import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { ItemSettings } from "./item-settings-policy";
const amount = z.string().regex(/^\d{1,14}(\.\d{1,4})?$/);
export const itemPricingInput = z
  .object({
    saleTaxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]).default("EXCLUSIVE"),
    purchaseTaxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]).default("EXCLUSIVE"),
    discountType: z.enum(["PERCENTAGE", "FIXED"]).default("PERCENTAGE"),
    discountValue: amount.default("0"),
    wholesalePrice: amount.optional(),
    mrp: amount.optional(),
  })
  .strict();
export type ItemPricingInput = z.input<typeof itemPricingInput>;
/** Master rates are tax-exclusive. Retain entered pricing choices separately for round trips. */
export function normalizedItemPricing(
  input: {
    sellingRate?: number | string;
    cost?: number | string;
    taxRate?: number | string;
    pricing?: z.infer<typeof itemPricingInput>;
  },
  settings: ItemSettings,
  rawPrices?: unknown,
) {
  if (!input.pricing)
    return { saleRate: input.sellingRate, costRate: input.cost };
  const raw =
    rawPrices && typeof rawPrices === "object"
      ? (rawPrices as Record<string, unknown>)
      : {};
  const exact = (key: "sellingRate" | "cost") => {
    const value =
      raw[key] === undefined || raw[key] === "" ? (input[key] ?? 0) : raw[key];
    if (typeof value !== "string" && typeof value !== "number")
      throw new Error("INVALID_AMOUNT");
    if (typeof value === "number" && Math.abs(value) > Number.MAX_SAFE_INTEGER)
      throw new Error("INVALID_AMOUNT");
    return new Prisma.Decimal(value);
  };
  const p = input.pricing,
    rate = new Prisma.Decimal(input.taxRate ?? 0),
    sale = exact("sellingRate"),
    cost = exact("cost"),
    discount = new Prisma.Decimal(p.discountValue);
  if (!settings.itemWiseDiscount && !discount.isZero())
    throw new Error("ITEM_DISCOUNT_DISABLED");
  if (!settings.wholesalePrice && p.wholesalePrice !== undefined)
    throw new Error("WHOLESALE_PRICING_DISABLED");
  if (p.mrp !== undefined && !settings.taxOnMrp) throw new Error("MRP_PRICING_DISABLED");
  if (
    (p.discountType === "PERCENTAGE" && discount.gt(100)) ||
    (p.discountType === "FIXED" && discount.gt(sale))
  )
    throw new Error("INVALID_DISCOUNT");
  const exclusive = (value: Prisma.Decimal, mode: string) =>
    (mode === "INCLUSIVE"
      ? value.mul(100).div(new Prisma.Decimal(100).add(rate))
      : value
    ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const saleRate = exclusive(sale, p.saleTaxMode),
    costRate = exclusive(cost, p.purchaseTaxMode);
  const pricing = {
    ...p,
    ...(p.mrp !== undefined ? { mrp: new Prisma.Decimal(p.mrp).toString(), mrpTaxMode: "INCLUSIVE", normalizedMrp: exclusive(new Prisma.Decimal(p.mrp), "INCLUSIVE").toFixed(2) } : {}),
    enteredSalePrice: sale.toFixed(2),
    enteredPurchasePrice: cost.toFixed(2),
    discountValue: discount.toString(),
    normalizedDiscountValue: (p.discountType === "FIXED"
      ? exclusive(discount, p.saleTaxMode)
      : discount
    ).toString(),
    ...(p.wholesalePrice !== undefined
      ? {
          normalizedWholesalePrice: exclusive(
            new Prisma.Decimal(p.wholesalePrice),
            p.saleTaxMode,
          ).toFixed(2),
        }
      : {}),
  };
  return { saleRate, costRate, pricing };
}
/** Only records with explicit normalized pricing use this conversion; legacy callers retain their existing contract. */
export function itemPriceForDocument(
  rate: Prisma.Decimal | string | number | null | undefined,
  taxRate: Prisma.Decimal | string | number | null | undefined,
  pricing: unknown,
  mode: string,
  purchase = false,
  quantity = "1",
  priceKind: "RETAIL" | "WHOLESALE" | "CUSTOMER" = "RETAIL",
  customerRate?: string,
) {
  const p =
    pricing && typeof pricing === "object" && !Array.isArray(pricing)
      ? (pricing as Record<string, unknown>)
      : null;
  const customer = !purchase && priceKind === "CUSTOMER";
  if (customer && (customerRate === undefined || !/^\d+(\.\d+)?$/.test(customerRate))) throw new Error("CUSTOMER_PRICE_UNAVAILABLE");
  const wholesale = !purchase && priceKind === "WHOLESALE";
  if (wholesale && (!p || typeof p.normalizedWholesalePrice !== "string"))
    throw new Error("WHOLESALE_PRICE_UNAVAILABLE");
  const base = new Prisma.Decimal(
      customer ? customerRate! : wholesale ? String(p!.normalizedWholesalePrice) : (rate ?? 0),
    ),
    tax = new Prisma.Decimal(taxRate ?? 0);
  if (!p || typeof p.enteredSalePrice !== "string")
    return {
      rate: customer && mode === "INCLUSIVE" ? base.mul(new Prisma.Decimal(100).add(tax)).div(100).toDecimalPlaces(2) : base,
      discountType: undefined,
      discountValue: new Prisma.Decimal(0),
    };
  const factor =
    mode === "INCLUSIVE"
      ? new Prisma.Decimal(100).add(tax).div(100)
      : new Prisma.Decimal(1);
  // Master fixed discounts apply per unit; explicit invoice line discounts retain their existing line-total contract.
  const discountType =
    !purchase && ["FIXED", "PERCENTAGE"].includes(String(p.discountType))
      ? (p.discountType as "FIXED" | "PERCENTAGE")
      : undefined;
  const raw =
    typeof p.normalizedDiscountValue === "string" &&
    /^\d+(\.\d+)?$/.test(p.normalizedDiscountValue)
      ? p.normalizedDiscountValue
      : "0";
  const enteredDiscount =
    typeof p.discountValue === "string" && /^\d+(\.\d+)?$/.test(p.discountValue)
      ? new Prisma.Decimal(p.discountValue)
      : null;
  const fixedBase = enteredDiscount
    ? p.saleTaxMode === "INCLUSIVE"
      ? enteredDiscount.mul(100).div(new Prisma.Decimal(100).add(tax))
      : enteredDiscount
    : new Prisma.Decimal(raw);
  const enteredPrice =
    p[
      purchase
        ? "enteredPurchasePrice"
        : wholesale
          ? "wholesalePrice"
          : "enteredSalePrice"
    ];
  const retainedGross =
    !customer && mode === "INCLUSIVE" &&
    p[purchase ? "purchaseTaxMode" : "saleTaxMode"] === "INCLUSIVE" &&
    typeof enteredPrice === "string" &&
    /^\d+(\.\d+)?$/.test(enteredPrice)
      ? new Prisma.Decimal(enteredPrice)
      : base.mul(factor);
  return {
    rate: retainedGross.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    discountType,
    discountValue: discountType
      ? discountType === "FIXED"
        ? fixedBase
            .mul(factor)
            .mul(quantity)
            .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        : new Prisma.Decimal(raw)
      : new Prisma.Decimal(0),
  };
}
/** Older editors send exclusive master rates; preserve the saved choices when those rates change. */
export function pricingForLegacyEdit(
  existing: {
    pricing: unknown;
    saleRate: Prisma.Decimal | null;
    costRate: Prisma.Decimal | null;
    taxRate: Prisma.Decimal | null;
  },
  input: {
    sellingRate?: number | string;
    cost?: number | string;
    taxRate?: number | string;
  },
  settings: ItemSettings,
  rawPrices?: unknown,
) {
  const p =
    existing.pricing &&
    typeof existing.pricing === "object" &&
    !Array.isArray(existing.pricing)
      ? (existing.pricing as Record<string, unknown>)
      : null;
  if (!p || typeof p.enteredSalePrice !== "string") return null;
  const choice = itemPricingInput.parse({
    saleTaxMode: p.saleTaxMode,
    purchaseTaxMode: p.purchaseTaxMode,
    discountType: p.discountType,
    discountValue: p.discountValue,
    ...(typeof p.mrp === "string" ? {mrp:p.mrp} : {}),
    ...(p.wholesalePrice === undefined
      ? {}
      : { wholesalePrice: p.wholesalePrice }),
  });
  const raw =
    rawPrices && typeof rawPrices === "object"
      ? (rawPrices as Record<string, unknown>)
      : {};
  const rate = new Prisma.Decimal(input.taxRate ?? existing.taxRate ?? 0);
  const entered = (
    key: "sellingRate" | "cost",
    fallback: Prisma.Decimal | null,
    mode: string,
  ) => {
    const net = new Prisma.Decimal(
      String(
        raw[key] === undefined || raw[key] === ""
          ? (input[key] ?? fallback ?? 0)
          : raw[key],
      ),
    );
    const original =
      p[key === "sellingRate" ? "enteredSalePrice" : "enteredPurchasePrice"];
    if (
      mode === "INCLUSIVE" &&
      net.eq(fallback ?? 0) &&
      rate.eq(existing.taxRate ?? 0) &&
      typeof original === "string"
    )
      return original;
    return net
      .mul(
        mode === "INCLUSIVE" ? new Prisma.Decimal(100).add(rate).div(100) : 1,
      )
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      .toString();
  };
  return normalizedItemPricing(
    {
      sellingRate: entered(
        "sellingRate",
        existing.saleRate,
        choice.saleTaxMode,
      ),
      cost: entered("cost", existing.costRate, choice.purchaseTaxMode),
      taxRate: rate.toString(),
      pricing: choice,
    },
    { ...settings, itemWiseDiscount: true, wholesalePrice: true, taxOnMrp:true },
  );
}

/** Omitted optional MRP must survive partial price edits and a disabled entry switch. */
export function retainItemMrp<T extends object>(next:T, previous:unknown, taxRate:Prisma.Decimal|string|number|null|undefined):T {
  const old=previous&&typeof previous==="object"&&!Array.isArray(previous)?previous as Record<string,unknown>:null;
  if("mrp" in next||!old||typeof old.mrp!=="string"||!amount.safeParse(old.mrp).success)return next;
  return {...next,mrp:old.mrp,mrpTaxMode:"INCLUSIVE",normalizedMrp:new Prisma.Decimal(old.mrp).mul(100).div(new Prisma.Decimal(100).add(taxRate??0)).toFixed(2)};
}
