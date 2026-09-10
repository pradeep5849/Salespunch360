import { getPublicQuotation } from "@/lib/quotations/service";
export async function GET(_:Request,{params}:{params:Promise<{token:string}>}){try{const {token}=await params;const r=await getPublicQuotation(token);return Response.json(r);}catch{return new Response("Quotation link is invalid or unavailable",{status:404});}}
