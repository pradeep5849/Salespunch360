import{notFound}from"next/navigation";
import{revalidatePath}from"next/cache";
import{branchTaxAction}from"@/app/actions/tax";
import{getTaxSettings,gstReport,updateCompanyTaxSettings}from"@/lib/account/tax";
import{AuthorizationError,requirePermissionForMutation}from"@/lib/auth/authorization";
import{db}from"@/lib/db";
import{TaxSettingsReference,type TaxPreferences}from"@/components/account/tax-settings-reference";
const iso=(d:Date)=>d.toISOString().slice(0,10);

export default async function Page({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<{from?:string;to?:string;branchId?:string}>}){
 const{section}=await params;if(!["settings","reports"].includes(section))notFound();
 const context=await getTaxSettings();
 if(section==="settings"){
  const transactionDefaults=(context.settings?.transactionDefaults as Record<string,unknown>|null)??{};
  const stored=(transactionDefaults.taxPreferences as TaxPreferences|undefined)??{};
  const values:TaxPreferences={
   gst:stored.gst??context.settings?.gstRegistrationType!=="UNREGISTERED",
   hsnSac:stored.hsnSac??true,
   additionalCess:stored.additionalCess??false,
   reverseCharge:stored.reverseCharge??false,
   stateOfSupply:stored.stateOfSupply??true,
   ewayBillNumber:stored.ewayBillNumber??false,
   compositeScheme:stored.compositeScheme??Boolean(context.settings?.compositionEnabled),
   enableTcs:stored.enableTcs??false,
   enableTds:stored.enableTds??false
  };
  async function save(fd:FormData){
   "use server";
   const actor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
   if(actor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
   const existing=await db.accountSettings.findUnique({where:{companyId:actor.companyId!}});
   const defaults=(existing?.transactionDefaults as Record<string,unknown>|null)??{};
   const itemSettings=(existing?.itemSettings as Record<string,unknown>|null)??{};
   const preferences:TaxPreferences={gst:fd.get("gst")==="on",hsnSac:fd.get("hsnSac")==="on",additionalCess:fd.get("additionalCess")==="on",reverseCharge:fd.get("reverseCharge")==="on",stateOfSupply:fd.get("stateOfSupply")==="on",ewayBillNumber:fd.get("ewayBillNumber")==="on",compositeScheme:fd.get("compositeScheme")==="on",enableTcs:fd.get("enableTcs")==="on",enableTds:fd.get("enableTds")==="on"};
   const txPrefs=(defaults.transactionPreferences as Record<string,unknown>|undefined)??{};
   const nextDefaults={...defaults,taxPreferences:preferences,transactionPreferences:{...txPrefs,transactionTax:preferences.gst,reverseCharge:preferences.reverseCharge,stateOfSupply:preferences.stateOfSupply,ewayBillNumber:preferences.ewayBillNumber}};
   const nextItemSettings={...itemSettings,itemWiseTax:preferences.gst,hsnSac:preferences.hsnSac,additionalCess:preferences.additionalCess};
   await db.accountSettings.upsert({where:{companyId:actor.companyId!},create:{companyId:actor.companyId!,transactionDefaults:nextDefaults,itemSettings:nextItemSettings},update:{transactionDefaults:nextDefaults,itemSettings:nextItemSettings}});
   const currentRegistration=existing?.gstRegistrationType??"UNREGISTERED";
   const gstRegistrationType=preferences.compositeScheme?"COMPOSITION":preferences.gst?(currentRegistration==="SEZ"?"SEZ":"REGULAR"):"UNREGISTERED";
   const taxProfile:{gstRegistrationType:"UNREGISTERED"|"REGULAR"|"COMPOSITION"|"SEZ";compositionEnabled:boolean;defaultTaxMode:"EXCLUSIVE"|"INCLUSIVE";defaultStateCode?:string}={gstRegistrationType,compositionEnabled:Boolean(preferences.compositeScheme),defaultTaxMode:existing?.defaultTaxMode??"EXCLUSIVE"};
   if(existing?.defaultStateCode)taxProfile.defaultStateCode=existing.defaultStateCode;
   await updateCompanyTaxSettings(taxProfile);
   await db.accountingAuditEvent.create({data:{companyId:actor.companyId!,actorUserId:actor.id,eventType:"SETTINGS_CHANGED",entityType:"ACCOUNT_SETTINGS",entityId:actor.companyId!,metadata:{sections:["TAX_GST"]}}});
   revalidatePath("/workspace/account/tax/settings");
  }
  return <TaxSettingsReference values={values} action={save}/>;
 }
 const q=await searchParams,from=new Date(q.from??`${new Date().getUTCFullYear()}-04-01`),to=new Date(q.to??new Date()),report=await gstReport({from,to,branchId:q.branchId});
 return <main className="employees-shell"><section className="employees-content"><h1>GST & Tax Report</h1><form method="get" className="stack"><input name="from" type="date" defaultValue={iso(from)}/><input name="to" type="date" defaultValue={iso(to)}/><select name="branchId" defaultValue={q.branchId}><option value="">Authorized Company</option>{context.branches.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select><button>Apply</button></form><p>Outward taxable {report.outward.taxable.toFixed(2)} · CGST {report.outward.cgst.toFixed(2)} · SGST {report.outward.sgst.toFixed(2)} · IGST {report.outward.igst.toFixed(2)}</p><p>Inward taxable {report.inward.taxable.toFixed(2)} · ITC components {report.inward.cgst.add(report.inward.sgst).add(report.inward.igst).add(report.inward.cess).toFixed(2)}</p><table><thead><tr><th>Date</th><th>Document</th><th>Party</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>CESS</th><th>TDS</th><th>TCS</th></tr></thead><tbody>{report.rows.map(x=><tr key={x.id}><td>{iso(x.date)}</td><td>{x.number}</td><td>{x.party}</td><td>{x.taxable.toFixed(2)}</td><td>{x.cgst.toFixed(2)}</td><td>{x.sgst.toFixed(2)}</td><td>{x.igst.toFixed(2)}</td><td>{x.cess.toFixed(2)}</td><td>{x.tds.toFixed(2)}</td><td>{x.tcs.toFixed(2)}</td></tr>)}</tbody></table></section></main>;
}
