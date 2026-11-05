import { db } from "@/lib/db";
import { requireAccountModules } from "./modules";
import { resolveItemSettings } from "./item-settings-policy";
export async function assertTransferAvailable(
  actor: { companyId: string | null },
  type: string,
) {
  if (type.toLowerCase() === "items") {
    await requireAccountModules(actor, "INVENTORY");
    const settings = await db.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { itemSettings: true },
    });
    if (!resolveItemSettings(settings?.itemSettings).enabled)
      throw new Error("ITEMS_DISABLED");
  }
  if (type.toLowerCase() === "projects")
    await requireAccountModules(actor, "PROJECTS");
}
export async function availableTransferTypes(actor: {
  companyId: string | null;
}) {
  const { enabledModulesForCompany } = await import("./modules");
  const [modules, settings] = await Promise.all([
    enabledModulesForCompany(actor.companyId!),
    db.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { itemSettings: true },
    }),
  ]);
  return [
    "customers",
    "vendors",
    ...(modules.includes("INVENTORY") &&
    resolveItemSettings(settings?.itemSettings).enabled
      ? ["items"]
      : []),
    ...(modules.includes("PROJECTS") ? ["projects"] : []),
    "chart-of-accounts",
  ];
}
