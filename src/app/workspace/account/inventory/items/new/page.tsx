import { inventoryOptions } from "@/lib/account/inventory";
import { savedHsnCodes } from "@/lib/account/saved-hsn-codes";
import { db } from "@/lib/db";
import { getItemWorkflowSettings } from "@/lib/account/item-workflow-settings";
import { accountMasterOverview } from "@/lib/account/service";
import { AddItemEditor } from "./add-item-editor";

export default async function AddItemPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const query = await searchParams;
  const [data, row, inventory] = await Promise.all([
    accountMasterOverview("products", {}),
    getItemWorkflowSettings(),
    inventoryOptions("opening"),
  ]);
  const customFields = row
    ? await db.customFieldDefinition.findMany({
        where: {
          companyId: row.companyId,
          entityType: { in: ["PRODUCT", "SERVICE"] },
          isActive: true,
        },
        orderBy: { position: "asc" },
      })
    : [];
  const hsnCodes = row.itemSettings.hsnSac
    ? await savedHsnCodes(row.companyId)
    : [];
  return (
    <AddItemEditor
      initialKind={query.kind === "services" ? "services" : "products"}
      units={data.accountUnits.map((x) => ({
        id: x.id,
        name: x.name,
        symbol: x.symbol,
      }))}
      categories={data.accountCategories.map((x) => ({
        id: x.id,
        name: x.name,
        scope: x.scope,
      }))}
      canManageSettings={row.canManageItemSettings}
      hsnCodes={hsnCodes}
      warehouses={inventory.warehouses.map((x) => ({ id: x.id, name: x.name }))}
      customFields={customFields}
      settings={(row?.itemSettings ?? {}) as Record<string, unknown>}
    />
  );
}
