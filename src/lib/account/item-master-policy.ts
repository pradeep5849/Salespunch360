import type { ItemSettings } from "./item-settings-policy";

type ItemMasterInput = {
  unitId?: string;
  categoryId?: string;
  description?: string;
  hsnSacCode?: string;
  taxRate?: unknown;
  trackInventory?: boolean;
  lowStockThreshold?: unknown;
  customFields?: Record<string, unknown>;
};
/** Creation policy only: toggles must not erase fields from historical item records. */
export function assertItemMasterCreation(
  settings: ItemSettings,
  kind: "PRODUCT" | "SERVICE",
  input: ItemMasterInput,
) {
  if (!settings.enabled) throw new Error("ITEMS_DISABLED");
  if (settings.itemType === "PRODUCTS" && kind === "SERVICE")
    throw new Error("SERVICES_DISABLED");
  if (settings.itemType === "SERVICES" && kind === "PRODUCT")
    throw new Error("PRODUCTS_DISABLED");
  if (!settings.itemUnits && input.unitId)
    throw new Error("ITEM_UNITS_DISABLED");
  if (!settings.itemCategory && input.categoryId)
    throw new Error("ITEM_CATEGORY_DISABLED");
  if (!settings.description && input.description?.trim())
    throw new Error("ITEM_DESCRIPTION_DISABLED");
  if (!settings.hsnSac && input.hsnSacCode?.trim())
    throw new Error("ITEM_HSN_DISABLED");
  if (!settings.itemWiseTax && Number(input.taxRate ?? 0) !== 0)
    throw new Error("ITEM_TAX_DISABLED");
  if (
    (!settings.stockMaintenance || kind === "SERVICE") &&
    (input.trackInventory || Number(input.lowStockThreshold ?? 0) !== 0)
  )
    throw new Error("STOCK_FIELDS_DISABLED");
  if (
    !settings.customFields &&
    Object.values(input.customFields ?? {}).some(
      (value) => value !== "" && value != null,
    )
  )
    throw new Error("ITEM_CUSTOM_FIELDS_DISABLED");
}
