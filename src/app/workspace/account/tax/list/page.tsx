import{revalidatePath}from"next/cache";
import{TaxListReference,type CustomTaxGroup,type CustomTaxRate}from"@/components/account/tax-list-reference";
import{AuthorizationError,requirePermission,requirePermissionForMutation}from"@/lib/auth/authorization";
import{db}from"@/lib/db";

type TaxCatalog={customRates?:CustomTaxRate[];customGroups?:CustomTaxGroup[]};
const rate=(value:FormDataEntryValue|null)=>{const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)throw new Error("INVALID_TAX_RATE");return Math.round(n*1000)/1000};
export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS"),companyId=actor.companyId!;
 const current=await db.accountSettings.findUnique({where:{companyId},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const catalog=(defaults.taxCatalog as TaxCatalog|undefined)??{};
 async function addRate(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  const name=String(fd.get("name")??"").trim().slice(0,80);if(!name)throw new Error("TAX_NAME_REQUIRED");const value=rate(fd.get("rate"));
  const row=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});const tx=(row?.transactionDefaults as Record<string,unknown>|null)??{};const existing=(tx.taxCatalog as TaxCatalog|undefined)??{};const customRates=[...(existing.customRates??[]).filter(x=>x.name.toLowerCase()!==name.toLowerCase()),{name,rate:value}].slice(-100);
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...tx,taxCatalog:{...existing,customRates}}},update:{transactionDefaults:{...tx,taxCatalog:{...existing,customRates}}}});revalidatePath("/workspace/account/tax/list");
 }
 async function addGroup(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  const name=String(fd.get("name")??"").trim().slice(0,80);if(!name)throw new Error("TAX_NAME_REQUIRED");const value=rate(fd.get("rate")),cgst=rate(fd.get("cgst")),sgst=rate(fd.get("sgst"));if(Math.abs(cgst+sgst-value)>.001)throw new Error("TAX_GROUP_SPLIT_MUST_MATCH_RATE");
  const row=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});const tx=(row?.transactionDefaults as Record<string,unknown>|null)??{};const existing=(tx.taxCatalog as TaxCatalog|undefined)??{};const customGroups=[...(existing.customGroups??[]).filter(x=>x.name.toLowerCase()!==name.toLowerCase()),{name,rate:value,cgst,sgst}].slice(-100);
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...tx,taxCatalog:{...existing,customGroups}}},update:{transactionDefaults:{...tx,taxCatalog:{...existing,customGroups}}}});revalidatePath("/workspace/account/tax/list");
 }
 return <TaxListReference customRates={catalog.customRates??[]} customGroups={catalog.customGroups??[]} addRate={addRate} addGroup={addGroup}/>;
}
