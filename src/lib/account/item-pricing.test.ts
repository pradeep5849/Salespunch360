import { itemCreationHash } from "./item-opening";
import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import {
  itemPricingInput,
  normalizedItemPricing,
  itemPriceForDocument,
  pricingForLegacyEdit,
} from "./item-pricing";
import { itemSettingsDefaults } from "./item-settings-policy";
const pricing = (extra = {}) =>
  itemPricingInput.parse({
    saleTaxMode: "INCLUSIVE",
    purchaseTaxMode: "INCLUSIVE",
    ...extra,
  });
it("normalizes inclusive master prices and retains entered modes and amounts", () => {
  const r = normalizedItemPricing(
    { sellingRate: "118", cost: "59", taxRate: "18", pricing: pricing() },
    itemSettingsDefaults,
  );
  expect(r.saleRate?.toString()).toBe("100");
  expect(r.costRate?.toString()).toBe("50");
  expect(r.pricing).toMatchObject({
    saleTaxMode: "INCLUSIVE",
    enteredSalePrice: "118.00",
    enteredPurchasePrice: "59.00",
  });
});
it("keeps exclusive prices and normalizes fixed discounts and wholesale in the entered sale mode", () => {
  const r = normalizedItemPricing(
    {
      sellingRate: "118",
      cost: "100",
      taxRate: "18",
      pricing: pricing({
        purchaseTaxMode: "EXCLUSIVE",
        discountType: "FIXED",
        discountValue: "11.8",
        wholesalePrice: "106.20",
      }),
    },
    itemSettingsDefaults,
  );
  expect(r.costRate?.toString()).toBe("100");
  expect(r.pricing).toMatchObject({
    normalizedDiscountValue: "10",
    normalizedWholesalePrice: "90.00",
  });
});
it("keeps percentage discounts as percentages", () =>
  expect(
    normalizedItemPricing(
      {
        sellingRate: "118",
        taxRate: "18",
        pricing: pricing({ discountValue: "10" }),
      },
      itemSettingsDefaults,
    ).pricing?.normalizedDiscountValue,
  ).toBe("10"));
it("does not rewrite legacy callers without pricing choices", () =>
  expect(
    normalizedItemPricing(
      { sellingRate: "118", cost: "59" },
      itemSettingsDefaults,
    ),
  ).toEqual({ saleRate: "118", costRate: "59" }));
it("rejects out-of-bounds discounts and disabled controls", () => {
  for (const p of [
    pricing({ discountValue: "101" }),
    pricing({ discountType: "FIXED", discountValue: "119" }),
  ])
    expect(() =>
      normalizedItemPricing(
        { sellingRate: "118", pricing: p },
        itemSettingsDefaults,
      ),
    ).toThrow("INVALID_DISCOUNT");
  expect(() =>
    normalizedItemPricing(
      { sellingRate: "100", pricing: pricing({ discountValue: "1" }) },
      { ...itemSettingsDefaults, itemWiseDiscount: false },
    ),
  ).toThrow("ITEM_DISCOUNT_DISABLED");
  expect(() =>
    normalizedItemPricing(
      { pricing: pricing({ wholesalePrice: "90" }) },
      { ...itemSettingsDefaults, wholesalePrice: false },
    ),
  ).toThrow("WHOLESALE_PRICING_DISABLED");
});
it("rejects invalid pricing payloads", () => {
  for (const value of ["-1", "1e3", "NaN", "1.12345"])
    expect(() => itemPricingInput.parse({ discountValue: value })).toThrow();
});

it("converts normalized catalogue defaults into the document tax mode", () => {
  const normalized = normalizedItemPricing(
    {
      sellingRate: "118",
      cost:"59",
      taxRate: "18",
      pricing: pricing({ discountValue: "10" }),
    },
    itemSettingsDefaults,
  );
  const inclusive = itemPriceForDocument(
    normalized.saleRate,
    "18",
    normalized.pricing,
    "INCLUSIVE",
  );
  expect(inclusive.rate.toFixed(2)).toBe("118.00");
  expect(inclusive.discountType).toBe("PERCENTAGE");
  expect(inclusive.discountValue.toString()).toBe("10");
  const purchase = itemPriceForDocument(
    "50",
    "18",
    normalized.pricing,
    "INCLUSIVE",
    true,
  );
  expect(purchase.rate.toFixed(2)).toBe("59.00");
  expect(purchase.discountType).toBeUndefined();
});

it("applies fixed master discounts per unit in the document tax basis", () => {
  const p = normalizedItemPricing(
    {
      sellingRate: "118",
      taxRate: "18",
      pricing: pricing({ discountType: "FIXED", discountValue: "11.8" }),
    },
    itemSettingsDefaults,
  ).pricing;
  expect(
    itemPriceForDocument(
      "100",
      "18",
      p,
      "EXCLUSIVE",
      false,
      "3",
    ).discountValue.toFixed(2),
  ).toBe("30.00");
  expect(
    itemPriceForDocument(
      "100",
      "18",
      p,
      "INCLUSIVE",
      false,
      "3",
    ).discountValue.toFixed(2),
  ).toBe("35.40");
});

it("retains exact per-unit inclusive discounts without multiplying a prematurely rounded net discount", () => {
  const p = normalizedItemPricing(
    {
      sellingRate: "118",
      taxRate: "18",
      pricing: pricing({ discountType: "FIXED", discountValue: "10" }),
    },
    itemSettingsDefaults,
  ).pricing;
  expect(
    itemPriceForDocument(
      "100",
      "18",
      p,
      "INCLUSIVE",
      false,
      "3",
    ).discountValue.toFixed(2),
  ).toBe("30.00");
  expect(
    itemPriceForDocument(
      "100",
      "18",
      p,
      "EXCLUSIVE",
      false,
      "3",
    ).discountValue.toFixed(2),
  ).toBe("25.42");
});

it("normalizes original decimal strings without losing large cents through schema Number coercion", () => {
  const result = normalizedItemPricing(
    {
      sellingRate: 99999999999999.98,
      pricing: pricing({ saleTaxMode: "EXCLUSIVE" }),
    },
    itemSettingsDefaults,
    { sellingRate: "99999999999999.99" },
  );
  expect(result.saleRate?.toString()).toBe("99999999999999.99");
});

it("preserves pricing choices when legacy editors change exclusive master rates", () => {
  const first = normalizedItemPricing(
    {
      sellingRate: "118",
      cost: "59",
      taxRate: "18",
      pricing: pricing({ discountType: "FIXED", discountValue: "11.8" }),
    },
    itemSettingsDefaults,
  );
  const next = pricingForLegacyEdit(
    {
      pricing: first.pricing,
      saleRate: new Prisma.Decimal(100),
      costRate: new Prisma.Decimal(50),
      taxRate: new Prisma.Decimal(18),
    },
    { sellingRate: "150" },
    itemSettingsDefaults,
  );
  expect(next?.saleRate?.toString()).toBe("150");
  expect(next?.costRate?.toString()).toBe("50");
  expect(next?.pricing).toMatchObject({
    enteredSalePrice: "177.00",
    enteredPurchasePrice: "59.00",
    saleTaxMode: "INCLUSIVE",
    discountValue: "11.8",
  });
});

it("includes exact entered cents in retry identity for normalized pricing", () => {
  const d = {
    name: "Item",
    sellingRate: 99999999999999.98,
    pricing: pricing(),
  };
  expect(
    itemCreationHash(d, {}, {}, { sellingRate: "99999999999999.98" }),
  ).not.toBe(itemCreationHash(d, {}, {}, { sellingRate: "99999999999999.99" }));
});

it("preserves percentage precision until the line amount is rounded", () =>
  expect(
    itemPriceForDocument(
      "1000",
      "18",
      {
        enteredSalePrice: "1000",
        discountType: "PERCENTAGE",
        normalizedDiscountValue: "33.335",
      },
      "EXCLUSIVE",
    ).discountValue.toString(),
  ).toBe("33.335"));

it("preserves entered inclusive cents instead of reconstructing them from rounded net rates", () => {
  const p = normalizedItemPricing(
    { sellingRate: "120", cost: "60", taxRate: "18", pricing: pricing() },
    itemSettingsDefaults,
  );
  expect(
    itemPriceForDocument(p.saleRate, "18", p.pricing, "INCLUSIVE").rate.toFixed(
      2,
    ),
  ).toBe("120.00");
  const edited = pricingForLegacyEdit(
    {
      pricing: p.pricing,
      saleRate: new Prisma.Decimal("101.69"),
      costRate: new Prisma.Decimal("50.85"),
      taxRate: new Prisma.Decimal("18"),
    },
    { sellingRate: "101.69" },
    itemSettingsDefaults,
  );
  expect(edited?.pricing?.enteredSalePrice).toBe("120.00");
});
