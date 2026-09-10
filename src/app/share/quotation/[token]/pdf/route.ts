import { getPublicQuotation } from "@/lib/quotations/service";
import { renderQuotationPdf } from "@/lib/quotations/pdf";
export async function GET(_:Request,{params}:{params:Promise<{token:string}>}){try{const {token}=await params;const r=await getPublicQuotation(token);return new Response(renderQuotationPdf(r),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="${r.document.documentNumber}-R${r.revisionNumber}.pdf"`}});}catch{return new Response("Quotation link is invalid or unavailable",{status:404});}}
