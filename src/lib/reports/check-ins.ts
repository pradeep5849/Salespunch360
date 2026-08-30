import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { durationMs, referenceDistance, visitKind } from "./metrics";
import { parseReportFilters, type SearchParams } from "./validation";
import { reportActor, reportEmployeeOptions, resolveEmployeeScope, type ReportActor } from "./scope";

export async function checkInReport(raw:SearchParams, advanced=false,providedActor?:ReportActor) {
  const actor=providedActor??await reportActor(), filters=parseReportFilters(raw), userIds=await resolveEmployeeScope(actor,filters.employeeId);
  const status=raw.status === "COMPLETED" || raw.status === "PENDING" ? raw.status : "ALL";
  const where:Prisma.CustomerVisitWhereInput={companyId:actor.companyId,userId:{in:userIds},checkedInAt:{gte:filters.start,lt:filters.endExclusive},...(status==="COMPLETED"?{checkedOutAt:{not:null}}:status==="PENDING"?{checkedOutAt:null}:{}),...(filters.q?{customer:{name:{contains:filters.q,mode:"insensitive"}}}:{})};
  const [total,completed,pending,leadAgg,visits,employees]=await Promise.all([
    db.customerVisit.count({where}), db.customerVisit.count({where:{...where,checkedOutAt:{not:null}}}), db.customerVisit.count({where:{...where,checkedOutAt:null}}),
    db.lead.count({where:{companyId:actor.companyId,sourceVisit:{is:where}}}),
    db.customerVisit.findMany({where,include:{user:{select:{name:true,role:true}},customer:{select:{name:true,latitude:true,longitude:true}},_count:{select:{leads:true}}},orderBy:[{checkedInAt:"desc"},{id:"desc"}],skip:(filters.page-1)*filters.pageSize,take:filters.pageSize}),
    reportEmployeeOptions(actor)
  ]);
  const rows=await Promise.all(visits.map(async v=>{
    const prior=advanced?await db.customerVisit.findMany({where:{companyId:actor.companyId,customerId:v.customerId,OR:[{checkedInAt:{lt:v.checkedInAt}},{checkedInAt:v.checkedInAt,id:{lt:v.id}}]},select:{id:true,checkedInAt:true},take:1}):[];
    return {...v,durationMs:durationMs(v.checkedInAt,v.checkedOutAt),referenceDistanceMeters:referenceDistance({latitude:v.checkInLatitude,longitude:v.checkInLongitude},v.customer),visitKind:advanced?visitKind(v,prior):undefined};
  }));
  let firstVisits=0,repeatVisits=0;
  if(advanced && userIds.length){
    const statusSql=status==="COMPLETED"?Prisma.sql`AND v."checkedOutAt" IS NOT NULL`:status==="PENDING"?Prisma.sql`AND v."checkedOutAt" IS NULL`:Prisma.empty;
    const customerSql=filters.q?Prisma.sql`AND c."name" ILIKE ${`%${filters.q}%`}`:Prisma.empty;
    const [kinds]=await db.$queryRaw<{first:bigint;repeat:bigint}[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM "customer_visits" prior WHERE prior."companyId"=v."companyId" AND prior."customerId"=v."customerId"
          AND (prior."checkedInAt" < v."checkedInAt" OR (prior."checkedInAt"=v."checkedInAt" AND prior."id" < v."id"))
      )) AS first, COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "customer_visits" prior WHERE prior."companyId"=v."companyId" AND prior."customerId"=v."customerId"
          AND (prior."checkedInAt" < v."checkedInAt" OR (prior."checkedInAt"=v."checkedInAt" AND prior."id" < v."id"))
      )) AS repeat FROM "customer_visits" v JOIN "customers" c ON c."id"=v."customerId"
      WHERE v."companyId"=${actor.companyId}::uuid AND v."userId" IN (${Prisma.join(userIds)})
        AND v."checkedInAt">=${filters.start} AND v."checkedInAt"<${filters.endExclusive} ${statusSql} ${customerSql}`);
    firstVisits=Number(kinds.first);repeatVisits=Number(kinds.repeat);
  }
  return {actor,filters,status,employees,rows,totalPages:Math.max(1,Math.ceil(total/filters.pageSize)),summary:{total,completed,pending,leadsGenerated:leadAgg,firstVisits,repeatVisits}};
}
