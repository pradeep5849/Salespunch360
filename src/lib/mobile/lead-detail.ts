import {z} from 'zod';
import {db} from '@/lib/db';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {visibilityWhere} from '@/lib/leads/policy';
import type {MobilePrincipal} from './auth';

const VISIT_LIMIT=50;
const ACTIVITY_LIMIT=100;

export async function mobileLeadDetail(user:MobilePrincipal,rawId:string){
 const id=z.string().uuid().parse(rawId),branches=await operationalBranchContext(user);
 const lead=await db.lead.findFirst({
  where:{id,companyId:user.companyId,branchId:branches.branchId,...visibilityWhere(user)},
  include:{
   customer:true,
   assignedUser:{select:{id:true,name:true}},
   sourceVisit:{select:{id:true,leadId:true,checkedInAt:true,checkedOutAt:true,checkInAddress:true,visitNotes:true,user:{select:{name:true}}}},
   visits:{where:{companyId:user.companyId},include:{user:{select:{name:true}}},orderBy:[{checkedInAt:'desc'},{id:'desc'}],take:VISIT_LIMIT+1},
   activities:{include:{actorUser:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:ACTIVITY_LIMIT+1},
   _count:{select:{visits:true,activities:true}},
  },
 });
 if(!lead)return null;
 const visitHasMore=lead.visits.length>VISIT_LIMIT,activityHasMore=lead.activities.length>ACTIVITY_LIMIT;
 let visits=lead.visits.slice(0,VISIT_LIMIT);
 if(lead.sourceVisit&&!visits.some(v=>v.id===lead.sourceVisit!.id))visits=[lead.sourceVisit as (typeof visits)[number],...visits].slice(0,VISIT_LIMIT);
 const visitCount=lead._count.visits+(lead.sourceVisit&&lead.sourceVisit.leadId!==lead.id?1:0);
 return{...lead,visits,activities:lead.activities.slice(0,ACTIVITY_LIMIT),visitHasMore,activityHasMore,visitCount,activityCount:lead._count.activities};
}
