import { inventoryOptions } from "@/lib/account/inventory";
import { savedHsnCodes } from "@/lib/account/saved-hsn-codes";
import { db } from "@/lib/db";
import { getItemWorkflowSettings } from "@/lib/account/item-workflow-settings";
import { accountMasterOverview } from "@/lib/account/service";

export async function addItemEditorOptions(){
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
  return {
 units:data.accountUnits.map(({id,name,symbol})=>({id,name,symbol})),
 categories:data.accountCategories.map(({id,name,scope})=>({id,name,scope})),
 canManageSettings:row.canManageItemSettings,hsnCodes,
 warehouses:inventory.warehouses.map(({id,name})=>({id,name})),customFields,
 settings:row.itemSettings as unknown as Record<string,unknown>,
 };
}
