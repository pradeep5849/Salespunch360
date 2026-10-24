import {db} from "@/lib/db";
import {verifyInvoiceShareToken} from "@/lib/account/invoice-share";
import {resolveTransactionMessaging} from "@/lib/account/transaction-messaging";
import {loadPrintDocumentForActor,renderAccountPrintHtml,renderAccountPrintPdf} from "@/lib/account/print";
import {applyInvoicePrintPreferences,type InvoicePrintPreferences} from "@/lib/account/invoice-print-preferences";

const headers={"cache-control":"private, no-store","referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow, noarchive","x-content-type-options":"nosniff"};
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const claims=verifyInvoiceShareToken((await params).token);
 const missing=()=>new Response("This invoice link is unavailable or has expired.",{status:404,headers});
 if(!claims)return missing();
 const [invoice,settings]=await Promise.all([
  db.commercialDocument.findFirst({where:{id:claims.id,companyId:claims.companyId,branchId:claims.branchId,type:"SALES_INVOICE",status:"POSTED"},select:{updatedAt:true}}),
  db.accountSettings.findUnique({where:{companyId:claims.companyId},select:{transactionDefaults:true}})
 ]);
 if(!invoice||invoice.updatedAt.toISOString()!==claims.version||!resolveTransactionMessaging(settings?.transactionDefaults).includeInvoiceLink)return missing();
 try{
  const data=await loadPrintDocumentForActor({companyId:claims.companyId,branchAccessScope:"SELECTED_BRANCHES",branchIds:[claims.branchId]},"SALES_INVOICE",claims.id,{includePartyBalance:false});
  const defaults=(settings?.transactionDefaults??{}) as Record<string,unknown>,preferences=(defaults.invoicePrintSettings??{}) as InvoicePrintPreferences;
  const applied=applyInvoicePrintPreferences("SALES_INVOICE",data.document,data.paper,{...preferences,partyCurrentBalance:false});
  const pdf=new URL(request.url).searchParams.get("format")==="pdf";
  return new Response(pdf?await renderAccountPrintPdf(applied.document,applied.paper):renderAccountPrintHtml(applied.document,applied.paper),{headers:{...headers,"content-type":pdf?"application/pdf":"text/html; charset=utf-8","content-disposition":pdf?'attachment; filename="invoice.pdf"':"inline"}});
 }catch(error){if(error instanceof Error&&error.message==="PRINT_DOCUMENT_NOT_FOUND")return missing();throw error}
}
