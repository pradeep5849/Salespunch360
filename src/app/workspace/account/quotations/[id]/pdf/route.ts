import { getCustomerQuotation } from "@/lib/quotations/service";
import { renderQuotationPdf } from "@/lib/quotations/pdf";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params,d=await getCustomerQuotation(id),r=d.revisions[0];return new Response(renderQuotationPdf(r as never),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${d.documentNumber}-R${r.revisionNumber}.pdf"`}});}catch{return new Response("Not found",{status:404});}}
