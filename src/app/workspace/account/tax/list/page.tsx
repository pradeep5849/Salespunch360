import {saveTaxCatalogEntry} from "@/lib/account/tax-catalog";
import{revalidatePath}from"next/cache";
import{TaxListReference,type CustomTaxGroup,type CustomTaxRate}from"@/components/account/tax-list-reference";
import{requirePermission,requirePermissionForMutation}from"@/lib/auth/authorization";
import{db}from"@/lib/db";

type TaxCatalog={customRates?:CustomTaxRate[];customGroups?:CustomTaxGroup[]};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS"),companyId=actor.companyId!;
 const current=await db.accountSettings.findUnique({where:{companyId},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const catalog=(defaults.taxCatalog as TaxCatalog|undefined)??{};
 async function addRate(fd:FormData){"use server";await saveTaxCatalogEntry(await requirePermissionForMutation("ACCOUNT_SETTINGS"),"RATE",fd);revalidatePath("/workspace/account/tax/list");}
 async function addGroup(fd:FormData){"use server";await saveTaxCatalogEntry(await requirePermissionForMutation("ACCOUNT_SETTINGS"),"GROUP",fd);revalidatePath("/workspace/account/tax/list");}
 return <TaxListReference customRates={catalog.customRates??[]} customGroups={catalog.customGroups??[]} addRate={addRate} addGroup={addGroup}/>;
}
