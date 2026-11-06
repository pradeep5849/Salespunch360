import {notFound,redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {getTaxSettings} from "@/lib/account/tax";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {saveTaxPreferences} from "@/lib/account/tax-preferences";
import {TaxSettingsReference,type TaxPreferences} from "@/components/account/tax-settings-reference";
export default async function Page({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<{from?:string;to?:string;branchId?:string}>}) {
 const {section}=await params;
 if(section==="reports") {
  const q=await searchParams;
  const query=new URLSearchParams(Object.entries(q).filter((entry):entry is [string,string]=>Boolean(entry[1]))).toString();
  redirect(`/workspace/account/reports/gst-party${query?`?${query}`:""}`);
 }
 if(section!=="settings")notFound();
 const context=await getTaxSettings(),defaults=(context.settings?.transactionDefaults as Record<string,unknown>|null)??{},stored=(defaults.taxPreferences as TaxPreferences|undefined)??{};
 const values:TaxPreferences={gst:context.settings?.gstRegistrationType!=="UNREGISTERED",hsnSac:true,stateOfSupply:true,compositeScheme:Boolean(context.settings?.compositionEnabled),...stored};
 async function save(fd:FormData) {"use server";
  const keys=["gst","hsnSac","additionalCess","reverseCharge","stateOfSupply","ewayBillNumber","compositeScheme","enableTcs","enableTds"];
  await saveTaxPreferences(await requirePermissionForMutation("ACCOUNT_SETTINGS"),{...Object.fromEntries(keys.map(key=>[key,fd.get(key)==="on"])),...(fd.get("compositionCategory")?{compositionCategory:fd.get("compositionCategory")}:{})});
  revalidatePath("/workspace/account/tax/settings");
 }
 return <TaxSettingsReference values={values} action={save}/>;
}
