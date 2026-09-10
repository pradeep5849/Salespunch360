import { getCustomerQuotation } from "@/lib/quotations/service";
import { renderQuotationPdf } from "@/lib/quotations/pdf";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params,r=await getCustomerQuotation(id);return new Response(renderQuotationPdf(r),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${r.document.documentNumber}-R${r.revisionNumber}.pdf"`}});}catch{return new Response("Not found",{status:404});}}
