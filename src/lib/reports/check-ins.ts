import { operationalBranchContext } from "@/lib/branches/operational-scope";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { durationMs, referenceDistance } from "./metrics";
import { parseReportFilters, reportUuid, type SearchParams } from "./validation";
import { reportActor, reportEmployeeOptions, resolveEmployeeScope, type ReportActor } from "./scope";

export async function checkInReport(raw:SearchParams, advanced=false,providedActor?:ReportActor,exportMode=false) {
  const actor=providedActor??await reportActor(), filters=parseReportFilters(raw,undefined,exportMode?10000:undefined), userIds=await resolveEmployeeScope(actor,filters.employeeId), branches=await operationalBranchContext(actor,reportUuid(raw,"branchId"));
  const status=raw.status === "COMPLETED" || raw.status === "ACTIVE" ? raw.status : "ALL",sentiment=raw.sentiment==="POSITIVE"||raw.sentiment==="NEUTRAL"||raw.sentiment==="NEGATIVE"?raw.sentiment:"ALL",customerId=reportUuid(raw,"customerId");
  const salesUnfiltered=actor.salesRole==="SALES"&&raw.start===undefined&&raw.end===undefined;
  const where:Prisma.CustomerVisitWhereInput={companyId:actor.companyId,branchId:branches.branchId,userId:{in:userIds},...(salesUnfiltered?{}:{checkedInAt:{gte:filters.start,lt:filters.endExclusive}}),...(status==="COMPLETED"?{checkedOutAt:{not:null}}:status==="ACTIVE"?{checkedOutAt:null}:{}),...(sentiment!=="ALL"?{checkoutSentiment:sentiment}:{}),...(customerId?{customerId}:{}),...(advanced&&filters.q?{customer:{name:{contains:filters.q,mode:"insensitive"}}}:{})};
  const [total,completed,pending,leadAgg,visits,employees,customers]=await Promise.all([
    db.customerVisit.count({where}), db.customerVisit.count({where:{AND:[where,{checkedOutAt:{not:null}}]}}), db.customerVisit.count({where:{AND:[where,{checkedOutAt:null}]}}),
    db.lead.count({where:{companyId:actor.companyId,sourceVisit:{is:where}}}),
    db.customerVisit.findMany({where,include:{photo:{select:{id:true}},user:{select:{name:true,salesRole:true}},customer:{select:{name:true,checkInReferenceLatitude:true,checkInReferenceLongitude:true}},completedFollowUpTask:{select:{id:true}},sourceLeads:{select:{id:true},take:1},_count:{select:{sourceLeads:true}}},orderBy:[{checkedInAt:"desc"},{id:"desc"}],skip:(filters.page-1)*filters.pageSize,take:filters.pageSize}),
    reportEmployeeOptions(actor), db.customer.findMany({where:{companyId:actor.companyId,branchId:branches.branchId},select:{id:true,name:true},orderBy:{name:"asc"}})
  ]);
  const priorVisitIds=new Set<string>();
  if(advanced&&visits.length){
    const prior=await db.$queryRaw<{id:string}[]>(Prisma.sql`SELECT current."id" FROM "customer_visits" current WHERE current."id" IN (${Prisma.join(visits.map(v=>Prisma.sql`${v.id}::uuid`))}) AND EXISTS (SELECT 1 FROM "customer_visits" previous WHERE previous."companyId"=current."companyId" AND previous."branchId"=current."branchId" AND previous."customerId"=current."customerId" AND (previous."checkedInAt"<current."checkedInAt" OR (previous."checkedInAt"=current."checkedInAt" AND previous."id"<current."id")))`);
    prior.forEach(({id})=>priorVisitIds.add(id));
  }
  const candidates=visits.filter(v=>v.userId===actor.id&&!v.leadId&&!v.customerId&&!v.completedFollowUpTask&&!v.sourceLeads.length).map(v=>v.id);
  const referenced=new Set<string>();
  if(candidates.length){
    const [leads,customers]=await Promise.all([
      db.lead.findMany({where:{companyId:actor.companyId,checkInReferenceVisitId:{in:candidates}},select:{checkInReferenceVisitId:true}}),
      db.customer.findMany({where:{companyId:actor.companyId,checkInReferenceVisitId:{in:candidates}},select:{checkInReferenceVisitId:true}}),
    ]);
    for(const record of [...leads,...customers])if(record.checkInReferenceVisitId)referenced.add(record.checkInReferenceVisitId);
  }
  const rows=visits.map(v=>{const{sourceLeads,completedFollowUpTask,...visit}=v;return{...visit,canDelete:v.userId===actor.id&&!v.leadId&&!v.customerId&&!completedFollowUpTask&&!sourceLeads.length&&!referenced.has(v.id),leadId:visit.leadId??sourceLeads[0]?.id??null,durationMs:durationMs(v.checkedInAt,v.checkedOutAt),referenceDistanceMeters:v.customer?referenceDistance({latitude:v.checkInLatitude,longitude:v.checkInLongitude},{latitude:v.customer.checkInReferenceLatitude,longitude:v.customer.checkInReferenceLongitude}):null,visitKind:advanced?(priorVisitIds.has(v.id)?"REPEAT VISIT":"FIRST VISIT"):undefined}});
  let firstVisits=0,repeatVisits=0;
  if(advanced && userIds.length){
    const statusSql=status==="COMPLETED"?Prisma.sql`AND v."checkedOutAt" IS NOT NULL`:status==="ACTIVE"?Prisma.sql`AND v."checkedOutAt" IS NULL`:Prisma.empty;const sentimentSql=sentiment!=="ALL"?Prisma.sql`AND v."checkoutSentiment"::text=${sentiment}`:Prisma.empty;
    const dateSql=salesUnfiltered?Prisma.empty:Prisma.sql`AND v."checkedInAt">=${filters.start} AND v."checkedInAt"<${filters.endExclusive}`;
    const selectedCustomerSql=customerId?Prisma.sql`AND v."customerId"=${customerId}::uuid`:Prisma.empty;
    const customerSql=filters.q?Prisma.sql`AND c."name" ILIKE ${`%${filters.q}%`}`:Prisma.empty;
    const [kinds]=await db.$queryRaw<{first:bigint;repeat:bigint}[]>(Prisma.sql`
      SELECT COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM "customer_visits" prior WHERE prior."companyId"=v."companyId" AND prior."branchId"=v."branchId" AND prior."customerId"=v."customerId"
          AND (prior."checkedInAt" < v."checkedInAt" OR (prior."checkedInAt"=v."checkedInAt" AND prior."id" < v."id"))
      )) AS first, COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "customer_visits" prior WHERE prior."companyId"=v."companyId" AND prior."branchId"=v."branchId" AND prior."customerId"=v."customerId"
          AND (prior."checkedInAt" < v."checkedInAt" OR (prior."checkedInAt"=v."checkedInAt" AND prior."id" < v."id"))
      )) AS repeat FROM "customer_visits" v LEFT JOIN "customers" c ON c."id"=v."customerId"
      WHERE v."companyId"=${actor.companyId}::uuid AND v."branchId" IN (${Prisma.join(branches.branchIds.map(id=>Prisma.sql`${id}::uuid`))}) AND v."userId" IN (${Prisma.join(userIds.map(id=>Prisma.sql`${id}::uuid`))})
        ${dateSql} ${statusSql} ${sentimentSql} ${customerSql} ${selectedCustomerSql}`);
    firstVisits=Number(kinds.first);repeatVisits=Number(kinds.repeat);
  }
  return {actor,filters,status,sentiment,customerId,customers,employees,rows,totalPages:Math.max(1,Math.ceil(total/filters.pageSize)),summary:{total,completed,pending,leadsGenerated:leadAgg,firstVisits,repeatVisits}};
}
