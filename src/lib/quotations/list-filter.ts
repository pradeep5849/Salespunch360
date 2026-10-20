import {QuotationStatus,Prisma} from "@prisma/client";
import {z} from "zod";
export const OPEN_QUOTATION_STATUSES:QuotationStatus[]=["DRAFT","PENDING_APPROVAL","APPROVED","SENT"];
export const CLOSED_QUOTATION_STATUSES:QuotationStatus[]=["ACCEPTED","REJECTED","DECLINED","EXPIRED","CANCELLED"];
export const quotationListInput=z.object({q:z.string().trim().max(160).optional(),status:z.union([z.nativeEnum(QuotationStatus),z.enum(["OPEN","CLOSED","ALL"])]).optional(),offset:z.coerce.number().int().min(0).max(1000000).default(0),limit:z.coerce.number().int().min(1).max(201).default(200)}).strict();
export function quotationListFilter(raw:unknown):{query:z.infer<typeof quotationListInput>;where:Prisma.QuotationDocumentWhereInput}{
 const query=quotationListInput.parse(raw);
 const status:Prisma.QuotationDocumentWhereInput=query.status==="OPEN"?{status:{in:OPEN_QUOTATION_STATUSES},convertedAt:null}:query.status==="CLOSED"?{OR:[{status:{in:CLOSED_QUOTATION_STATUSES}},{convertedAt:{not:null}}]}:query.status&&query.status!=="ALL"?{status:query.status}:{};
 const search:Prisma.QuotationDocumentWhereInput=query.q?{OR:[{documentNumber:{contains:query.q,mode:"insensitive"}},{revisions:{some:{customerName:{contains:query.q,mode:"insensitive"}}}}]}:{};
 return {query,where:query.status==="CLOSED"&&query.q?{AND:[status,search]}:{...status,...search}};
}
