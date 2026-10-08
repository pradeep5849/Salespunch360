import type {PrintPaperSize} from "@prisma/client";
import {db} from "@/lib/db";
import {requirePermission} from "@/lib/auth/authorization";
import type {AccountPrintDocument} from "./print";

export type InvoicePrintPreferences=Record<string,string|number|boolean>;
const enabled=(settings:InvoicePrintPreferences,key:string,fallback:boolean)=>typeof settings[key]==="boolean"?settings[key] as boolean:fallback;
const text=(settings:InvoicePrintPreferences,key:string,fallback="")=>typeof settings[key]==="string"?settings[key] as string:fallback;

export async function loadInvoicePrintPreferences(documentType:string){
 const permission=["QUOTATION","BOQ"].includes(documentType)?"ACCOUNT_QUOTATION_VIEW":"ACCOUNT_LEDGER_VIEW";
 const actor=await requirePermission(permission);
 const row=await db.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{transactionDefaults:true}});
 const defaults=(row?.transactionDefaults as Record<string,unknown>|null)??{};
 return (defaults.invoicePrintSettings as InvoicePrintPreferences|undefined)??{};
}

export function applyInvoicePrintPreferences(documentType:string,doc:AccountPrintDocument,paper:PrintPaperSize,settings:InvoicePrintPreferences){
 if(documentType!=="SALES_INVOICE")return{document:doc,paper};
 const printer=text(settings,"printer","REGULAR"),pageSize=text(settings,"pageSize","A4");
 const preferredPaper:PrintPaperSize=printer==="THERMAL"||pageSize==="THERMAL_80MM"?"THERMAL_80MM":"A4";
 const transactionName=text(settings,"transactionName",doc.title).trim()||doc.title;
 const termsText=text(settings,"termsText",doc.terms??"").trim();
 const customSignature=text(settings,"customSignatureText",doc.authorizedSignatory??"").trim();
 const taxDetails=enabled(settings,"taxDetails",true);
 const adjusted:AccountPrintDocument={
  ...doc,
  title:transactionName,
  company:enabled(settings,"printCompanyName",true)?doc.company:"",
  logoDataUrl:enabled(settings,"companyLogo",true)?doc.logoDataUrl:null,
  companyAddress:enabled(settings,"address",true)?doc.companyAddress:null,
  companyGstin:enabled(settings,"gstinOnSale",true)?doc.companyGstin:null,
  companyPhone:enabled(settings,"phone",true)?doc.companyPhone:null,
  companyEmail:enabled(settings,"email",true)?doc.companyEmail:null,
  cgst:taxDetails?doc.cgst:"0",
  sgst:taxDetails?doc.sgst:"0",
  igst:taxDetails?doc.igst:"0",
  cess:taxDetails?doc.cess:"0",
  terms:enabled(settings,"termsEnabled",true)?(termsText||doc.terms):null,
  authorizedSignatory:enabled(settings,"signatureText",true)?(customSignature||doc.authorizedSignatory):null,
  signatureDataUrl:enabled(settings,"signatureText",true)?doc.signatureDataUrl:null,
  paymentMode:enabled(settings,"paymentMode",true)?doc.paymentMode:undefined,
 };
 return{document:adjusted,paper:preferredPaper};
}
