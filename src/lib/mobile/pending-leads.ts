import type {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db} from '@/lib/db';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {pendingVisitWhere} from '@/lib/leads/policy';
import type {MobilePrincipal} from './auth';

const pagingSchema=z.object({page:z.coerce.number().int().min(1).optional(),pageSize:z.coerce.number().int().min(1).max(100).optional(),q:z.string().trim().max(100).optional(),employeeId:z.string().uuid().optional()}).passthrough();
async function scopedWhere(user:MobilePrincipal,employeeId?:string,q?:string):Promise<Prisma.CustomerVisitWhereInput>{
 const base=pendingVisitWhere(user);let selected:Prisma.CustomerVisitWhereInput={};
 if(employeeId){
  const allowed=await db.user.findFirst({where:{id:employeeId,companyId:user.companyId,isActive:true,salesAccessActive:true,...((user.salesRole==='PRIMARY_ADMIN'||user.salesRole==='ADMIN')?{salesRole:{in:['MANAGER','SALES']}}:user.salesRole==='MANAGER'?(user.managerType==='MANAGER_ONLY'?{salesRole:'SALES',managerId:user.id}:{OR:[{id:user.id,salesRole:'MANAGER'},{salesRole:'SALES',managerId:user.id}]}):{id:user.id})},select:{id:true}});
  if(!allowed)throw new Error('NOT_FOUND');selected={userId:allowed.id};
 }
 const search=q?{OR:[{contactName:{contains:q,mode:'insensitive' as const}},{contactPhone:{contains:q,mode:'insensitive' as const}},{customer:{name:{contains:q,mode:'insensitive' as const}}}]}:{};
 return{AND:[base,selected,search]};
}
export async function mobilePendingLeadPage(user:MobilePrincipal,raw:Record<string,string|undefined>={}){
 const f=pagingSchema.parse(raw),branches=await operationalBranchContext(user),where={AND:[await scopedWhere(user,f.employeeId,f.q),{branchId:branches.branchId}]};
 const compatibility=!f.page,page=f.page??1,pageSize=compatibility?200:(f.pageSize??50),skip=(page-1)*pageSize;
 const [count,rows]=await Promise.all([
  db.customerVisit.count({where}),
  db.customerVisit.findMany({where,include:{user:{select:{id:true,name:true}},customer:{select:{name:true}},photo:{select:{id:true}}},orderBy:[{checkedInAt:'desc'},{id:'desc'}],skip,take:pageSize+1}),
 ]);
 const hasMore=rows.length>pageSize,visits=rows.slice(0,pageSize).map(v=>({id:v.id,contactName:v.contactName,customerName:v.customer?.name??null,userId:v.user.id,userName:v.user.name,checkedInAt:v.checkedInAt,checkedOutAt:v.checkedOutAt,visitNotes:v.visitNotes,checkInAddress:v.checkInAddress,checkInLatitude:v.checkInLatitude,checkInLongitude:v.checkInLongitude,hasPhoto:Boolean(v.photo),photoUrl:v.photo?`/api/v1/mobile/visit-photos/${v.id}/thumbnail`:null,canAddPhone:v.user.id===user.id}));
 return{count,page,pageSize,hasMore,visits};
}
