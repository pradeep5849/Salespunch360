import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
type Actor={companyId:string|null;branchAccessScope?:string|null;branchIds?:string[]};
type Row={sourceId:string;documentNumber:string;issueDate:Date;rate:Prisma.Decimal;taxMode:string};
export async function recentSalePrices(actor:Actor,enabled:boolean){
 if(!enabled||!actor.companyId)return [];
 const branches=actor.branchAccessScope==="SELECTED_BRANCHES"?actor.branchIds??[]:null;
 if(branches?.length===0)return [];
 const branchFilter=branches?Prisma.sql`AND d."branchId"::text IN (${Prisma.join(branches)})`:Prisma.empty;
 return db.$queryRaw<Row[]>(Prisma.sql`
  SELECT "sourceId", "documentNumber", "issueDate", rate, "taxMode" FROM (
   SELECT COALESCE(l."productId",l."serviceId")::text AS "sourceId",d."documentNumber",d."issueDate",l.rate,d."taxMode",
    row_number() OVER (PARTITION BY COALESCE(l."productId",l."serviceId") ORDER BY d."issueDate" DESC,d."createdAt" DESC,l.id DESC) AS position
   FROM commercial_document_lines l JOIN commercial_documents d ON d.id=l."documentId" AND d."companyId"=l."companyId"
   WHERE d."companyId"::text=${actor.companyId} AND d.type='SALES_INVOICE' AND d.status='POSTED'
    AND COALESCE(l."productId",l."serviceId") IS NOT NULL ${branchFilter}
  ) prices WHERE position<=5 ORDER BY "sourceId",position
 `);
}
