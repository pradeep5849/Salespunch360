import {revalidatePath} from "next/cache";
import {InvoicePrintSettingsForm,type InvoicePrintSettings} from "@/components/account/invoice-print-settings-form";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import { printSettingsFromForm } from "@/lib/account/invoice-print-settings";
import { updateSettingsSectionForActor } from "@/lib/account/settings-persistence";

export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");
 const current=await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const banks=await db.moneyAccount.findMany({where:{companyId:actor.companyId!,type:"BANK",isActive:true,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{OR:[{branchId:null},{branchId:{in:actor.branchIds??[]}}]}:{})},select:{id:true,name:true},orderBy:{name:"asc"}});
 const values=((defaults.invoicePrintSettings as InvoicePrintSettings|undefined)??{});
 async function save(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  await updateSettingsSectionForActor(editor, "invoicePrintSettings", printSettingsFromForm(fd));
  revalidatePath("/workspace/account/settings/print-templates");
 }
 return <InvoicePrintSettingsForm values={values} action={save} banks={banks}/>;
}
