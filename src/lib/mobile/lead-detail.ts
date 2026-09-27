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
   visits:{where:{companyId:user.companyId},include:{user:{select:{name:true}}},orderBy:[{checkedInAt:'desc'},{id:'desc'}],take:VISIT_LIMIT+1},
   activities:{include:{actorUser:{select:{name:true}}},orderBy:[{createdAt:'desc'},{id:'desc'}],take:ACTIVITY_LIMIT+1},
   _count:{select:{visits:true,activities:true}},
  },
 });
 if(!lead)return null;
 const visitHasMore=lead.visits.length>VISIT_LIMIT,activityHasMore=lead.activities.length>ACTIVITY_LIMIT;
 let visits=lead.visits.slice(0,VISIT_LIMIT);
 if(lead.sourceVisitId&&!visits.some(v=>v.id===lead.sourceVisitId)){
  const source=await db.customerVisit.findFirst({where:{id:lead.sourceVisitId,companyId:user.companyId,branchId:branches.branchId},include:{user:{select:{name:true}}}});
  if(source)visits=[source,...visits].slice(0,VISIT_LIMIT);
 }
 return{...lead,visits,activities:lead.activities.slice(0,ACTIVITY_LIMIT),visitHasMore,activityHasMore,visitCount:lead._count.visits+(lead.sourceVisitId?1:0),activityCount:lead._count.activities};
}
