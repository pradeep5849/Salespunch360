import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {canUsePermission} from "@/lib/auth/permissions";
import {loadPrintDocumentForActor,renderAccountPrintPdf} from "@/lib/account/print";
import {applyInvoicePrintPreferences} from "@/lib/account/invoice-print-preferences";
import {db} from "@/lib/db";
import {mobileUnauthorized,mobileAuthorizationFailure,mobileUnexpected} from "@/lib/mobile/http";
export async function GET(request:Request,{params}:{params:Promise<{documentType:string;id:string}>}){
 try{
 const user=await authenticateMobileToken(request.headers.get("authorization")),actor=mobileAccountActor(user),p=await params,type=p.documentType.toUpperCase();
 if(!canUsePermission(actor,user.productEdition,["QUOTATION","BOQ"].includes(type)?"ACCOUNT_QUOTATION_VIEW":"ACCOUNT_LEDGER_VIEW"))throw new Error("MOBILE_FORBIDDEN");
 const data=await loadPrintDocumentForActor(actor,type,p.id),settings=await db.accountSettings.findUnique({where:{companyId:actor.companyId},select:{transactionDefaults:true}}),defaults=(settings?.transactionDefaults??{}) as Record<string,unknown>,preferences=(defaults.invoicePrintSettings??{}) as Record<string,string|number|boolean>,applied=applyInvoicePrintPreferences(type,data.document,data.paper,preferences);
 return new Response(await renderAccountPrintPdf(applied.document,applied.paper),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="invoice.pdf"`,"Cache-Control":"private, no-store"}});
 }catch(error){if(error instanceof Error&&["PRINT_DOCUMENT_NOT_FOUND","UNSUPPORTED_PRINT_DOCUMENT_TYPE"].includes(error.message))return new Response("Not found",{status:404});return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_ACCOUNT_PRINT",error);}
}
