import {db} from '@/lib/db';
import {searchCustomersForCompany} from '@/lib/customers/service';
import {checkInForUser,checkoutForUser,fieldCheckInForUser,getOwnVisitHistoryForUser} from '@/lib/visits/service';
import {mobileFieldWorkEnabled,type MobilePrincipal} from './auth';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
export class MobileFieldError extends Error{constructor(public code:string,public status=400){super(code)}}
function field(user:MobilePrincipal){if(!mobileFieldWorkEnabled(user))throw new MobileFieldError('FORBIDDEN',403);return user}
export async function mobileFieldContext(user:MobilePrincipal,query=''){const principal=field(user),branches=await operationalBranchContext(principal);const [customers,visits]=await Promise.all([searchCustomersForCompany(principal.companyId,query,principal.id,branches.branchIds),getOwnVisitHistoryForUser(principal)]);const links=visits.length?await db.customerVisit.findMany({where:{companyId:principal.companyId,userId:principal.id,id:{in:visits.map(v=>v.id)}},select:{id:true,leadId:true,visitType:true,contactName:true}}):[];const linkById=new Map(links.map(v=>[v.id,v]));return{branches:branches.branches.map(({id})=>({id})),customers:customers.map(({id,name,contactPerson,phone,email,address,latitude,longitude,checkInReferenceSetAt})=>({id,name,contactPerson,phone,email,address,latitude,longitude,checkInReferenceSetAt})),visits:visits.map(({_count,...visit})=>({...visit,...linkById.get(visit.id),leadCount:_count.sourceLeads}))}}
export async function mobileCheckIn(user:MobilePrincipal,raw:unknown){const result=await checkInForUser(field(user),raw);return{visitId:result.id,checkedInAt:result.checkedInAt}}
export async function mobileFieldCheckIn(user:MobilePrincipal,raw:unknown,photo?:File){const result=await fieldCheckInForUser(field(user),raw,photo);return{visitId:result.id,checkedInAt:result.checkedInAt,leadId:result.leadId}}
export async function mobileCheckout(user:MobilePrincipal,raw:unknown){await checkoutForUser(field(user),raw);return{ok:true}}
