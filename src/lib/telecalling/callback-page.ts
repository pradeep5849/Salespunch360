import {Prisma,type SalesRole} from '@prisma/client';
import {db} from '@/lib/db';
import {assertActiveTelecallerEntitlement} from '@/lib/billing/telecaller';
import {decodeFollowUpNotes} from '@/lib/follow-up-tasks/type';
import {isTelecaller} from './policy';
import type {CallbackQueueItem} from './service';

type Actor={id:string;companyId:string;salesRole:SalesRole;designation?:string|null};
export type CallbackPageItem=CallbackQueueItem&{assigneeName:string|null};
export async function callbackPageForActor(actor:Actor,requestedPage=1){
 const telecaller=isTelecaller(actor),admin=actor.salesRole==='PRIMARY_ADMIN'||actor.salesRole==='ADMIN',manager=actor.salesRole==='MANAGER',own=telecaller||actor.salesRole==='SALES';
 if(!admin&&!manager&&!own)throw new Error('NOT_AUTHORIZED');
 if(telecaller)await assertActiveTelecallerEntitlement(actor.companyId);
 const page=Number.isSafeInteger(requestedPage)&&requestedPage>0?Math.min(requestedPage,1000000):1,pageSize=100;
 // Apply visibility to each source before UNION/paging. Task dates remain date-only for bucket policy.
 const rows=await db.$queryRaw<CallbackPageItem[]>(Prisma.sql`
 SELECT * FROM (
  SELECT c.id,c."leadId",c."callerUserId",u.name AS "callerName",c.result::text,c.notes,c."calledAt",c."nextCallbackAt",c."callbackAssigneeUserId",
   c."dialStartedAt",c."dialEndedAt",c."dialDurationSeconds",c."timingSource"::text,l.title AS "leadTitle",l.phone,owner.name AS "ownerName",NULL::uuid AS "followUpTaskId",NULL::text AS "assigneeName",NULL::uuid AS "callbackCallId"
  FROM "lead_calls" c JOIN "leads" l ON l.id=c."leadId" JOIN "users" u ON u.id=c."callerUserId" JOIN "users" owner ON owner.id=l."assignedUserId"
  WHERE c."companyId"=${actor.companyId}::uuid AND c.result='CALL_BACK' AND c."nextCallbackAt" IS NOT NULL
   ${own?Prisma.sql`AND c."callbackAssigneeUserId"=${actor.id}::uuid`:Prisma.empty}
   ${manager?Prisma.sql`AND (l."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)`:Prisma.empty}
   AND NOT EXISTS (SELECT 1 FROM "follow_up_tasks" linked WHERE linked."callbackCallId"=c.id)
   AND NOT EXISTS (SELECT 1 FROM "lead_calls" n WHERE n."companyId"=c."companyId" AND n."leadId"=c."leadId" AND n."callerUserId"=c."callbackAssigneeUserId" AND n."calledAt">c."calledAt")
  UNION ALL
  SELECT t.id,t."leadId",t."createdByUserId",creator.name,'CALL_BACK'::text,t.notes,t."createdAt",coalesce(t."callbackAt",t."dueDate"),t."assignedUserId",
   NULL::timestamp,NULL::timestamp,NULL::integer,NULL::text,l.title,l.phone,owner.name,t.id,assignee.name,t."callbackCallId"
  FROM "follow_up_tasks" t JOIN "leads" l ON l.id=t."leadId" JOIN "users" owner ON owner.id=l."assignedUserId" JOIN "users" creator ON creator.id=t."createdByUserId" JOIN "users" assignee ON assignee.id=t."assignedUserId"
  WHERE t."companyId"=${actor.companyId}::uuid AND t.status='PENDING' AND t.notes LIKE '[[SP360_FOLLOW_UP:CALL]]%'
   AND (upper(replace(coalesce(assignee.designation,''),' ',''))='TELECALLER' OR t."callbackCallId" IS NOT NULL) AND assignee."isActive"=TRUE
   ${own?Prisma.sql`AND t."assignedUserId"=${actor.id}::uuid`:Prisma.empty}

   ${manager?Prisma.sql`AND (l."assignedUserId"=${actor.id}::uuid OR owner."managerId"=${actor.id}::uuid)`:Prisma.empty}
 ) queue ORDER BY "nextCallbackAt" ASC,id ASC,"followUpTaskId" ASC NULLS FIRST LIMIT ${pageSize+1} OFFSET ${(page-1)*pageSize}`);
 return {page,pageSize,hasMore:rows.length>pageSize,items:rows.slice(0,pageSize).map(row=>({...row,...(row.followUpTaskId?{notes:decodeFollowUpNotes(row.notes).notes}:{} )}))};
}
