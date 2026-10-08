import {revalidatePath} from "next/cache";
import {InvoicePrintSettingsForm,type InvoicePrintSettings} from "@/components/account/invoice-print-settings-form";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";

const BOOLS=["regularDefault","repeatHeader","printCompanyName","companyLogo","address","email","phone","gstinOnSale","billOfSupply","originalDuplicate","expandTable","totalItemQuantity","amountDecimal","receivedAmount","balanceAmount","partyCurrentBalance","taxDetails","amountGrouping","youSaved","printDescription","termsEnabled","receivedBy","deliveredBy","signatureText","paymentMode","acknowledgement","pageNumbers"] as const;
const STRINGS=["printer","theme","printTextSize","pageSize","orientation","companyNameTextSize","amountWordsFormat","termsText","customSignatureText","transactionName","itemTableColumns"] as const;

export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");
 const current=await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{transactionDefaults:true}});
 const defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const values=((defaults.invoicePrintSettings as InvoicePrintSettings|undefined)??{});
 async function save(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  const existing=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});
  const transactionDefaults=(existing?.transactionDefaults as Record<string,unknown>|null)??{};
  const invoicePrintSettings:InvoicePrintSettings={};
  for(const key of BOOLS)invoicePrintSettings[key]=fd.get(key)==="on";
  for(const key of STRINGS)invoicePrintSettings[key]=String(fd.get(key)??"").slice(0,key==="termsText"?10000:500);
  invoicePrintSettings.topSpace=Math.max(0,Math.min(20,Number(fd.get("topSpace")||0)));
  invoicePrintSettings.minRows=Math.max(0,Math.min(50,Number(fd.get("minRows")||0)));
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...transactionDefaults,invoicePrintSettings}},update:{transactionDefaults:{...transactionDefaults,invoicePrintSettings}}});
  await db.accountingAuditEvent.create({data:{companyId:editor.companyId!,actorUserId:editor.id,eventType:"SETTINGS_CHANGED",entityType:"ACCOUNT_SETTINGS",entityId:editor.companyId!,metadata:{sections:["INVOICE_PRINT"]}}});
  revalidatePath("/workspace/account/settings/print-templates");
 }
 return <InvoicePrintSettingsForm values={values} action={save}/>;
}
