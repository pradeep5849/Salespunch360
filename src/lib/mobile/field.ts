import {searchCustomersForCompany} from '@/lib/customers/service';
import {checkInForUser,checkoutForUser,fieldCheckInForUser,getOwnVisitHistoryForUser} from '@/lib/visits/service';
import type {MobilePrincipal} from './auth';
export class MobileFieldError extends Error{constructor(public code:string,public status=400){super(code)}}
function field(user:MobilePrincipal){if(user.role==='COMPANY_ADMIN'||(user.role==='MANAGER'&&user.managerType==='MANAGER_ONLY'))throw new MobileFieldError('FORBIDDEN',403);return{...user,salesRole:user.role}}
export async function mobileFieldContext(user:MobilePrincipal,query=''){const principal=field(user);const [customers,visits]=await Promise.all([searchCustomersForCompany(principal.companyId,query,principal.id),getOwnVisitHistoryForUser(principal)]);return{customers:customers.map(({id,name,contactPerson,phone,email,address,latitude,longitude,checkInReferenceSetAt})=>({id,name,contactPerson,phone,email,address,latitude,longitude,checkInReferenceSetAt})),visits:visits.map(({_count,...visit})=>({...visit,leadCount:_count.sourceLeads}))}}
export async function mobileCheckIn(user:MobilePrincipal,raw:unknown){const result=await checkInForUser(field(user),raw);return{visitId:result.id,checkedInAt:result.checkedInAt}}
export async function mobileFieldCheckIn(user:MobilePrincipal,raw:unknown,photo?:File){const result=await fieldCheckInForUser(field(user),raw,photo);return{visitId:result.id,checkedInAt:result.checkedInAt,leadId:result.leadId}}
export async function mobileCheckout(user:MobilePrincipal,raw:unknown){await checkoutForUser(field(user),raw);return{ok:true}}
