import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { requireAccountModules } from "./modules";
import { resolveItemSettings } from "./item-settings-policy";

/** Operational item presentation settings; this does not grant settings administration. */
export async function getItemWorkflowSettings() {
  const actor = await requirePermission("ACCOUNT_STOCK");
  await requireAccountModules(actor, "INVENTORY");
  const row = await db.accountSettings.findUnique({
    where: { companyId: actor.companyId! },
    select: { itemSettings: true },
  });
  const itemSettings = resolveItemSettings(row?.itemSettings);
  if (!itemSettings.enabled) throw new Error("ITEMS_DISABLED");
  return { companyId: actor.companyId!, itemSettings };
}
