import { db } from "@/lib/db";
import { requireAccountModules } from "./modules";
import { resolveItemSettings } from "./item-settings-policy";
import {AuthorizationError} from "@/lib/auth/authorization";
/** Project Managers retain assigned-project exports, not company-wide master catalogues. */
export function assertExportRole(actor:{accountRole?:string|null},type:string){
 if(!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(actor.accountRole??"")&&!(actor.accountRole==="PROJECT_MANAGER"&&type==="projects"))throw new AuthorizationError();
}
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
  accountRole?:string|null;
},mode:"IMPORT"|"EXPORT"="EXPORT") {
  const { enabledModulesForCompany } = await import("./modules");
  const [modules, settings] = await Promise.all([
    enabledModulesForCompany(actor.companyId!),
    db.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { itemSettings: true },
    }),
  ]);
  const types=[
    "customers",
    "vendors",
    ...(modules.includes("INVENTORY") &&
    resolveItemSettings(settings?.itemSettings).enabled
      ? ["items"]
      : []),
    ...(modules.includes("PROJECTS") ? ["projects"] : []),
    "chart-of-accounts",
  ];
  if(mode==="IMPORT")return types;
  return types.filter(type=>{try{assertExportRole(actor,type);return true}catch{return false}});
}
