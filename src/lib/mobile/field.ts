import {searchCustomersForCompany} from '@/lib/customers/service';
import {checkInForUser,checkoutForUser,getOwnVisitHistoryForUser} from '@/lib/visits/service';
import type {MobilePrincipal} from './auth';
export class MobileFieldError extends Error{constructor(public code:string,public status=400){super(code)}}
function field(user:MobilePrincipal){if(user.role==='COMPANY_ADMIN')throw new MobileFieldError('FORBIDDEN',403);return user}
export async function mobileFieldContext(user:MobilePrincipal,query=''){const principal=field(user);const [customers,visits]=await Promise.all([searchCustomersForCompany(principal.companyId,query),getOwnVisitHistoryForUser(principal)]);return{customers:customers.map(({id,name,contactPerson,phone,email,address,latitude,longitude})=>({id,name,contactPerson,phone,email,address,latitude,longitude})),visits}}
export async function mobileCheckIn(user:MobilePrincipal,raw:unknown){const result=await checkInForUser(field(user),raw);return{visitId:result.visit.id,checkedInAt:result.visit.checkedInAt,isFirstVisit:result.isFirstVisit,isRepeatVisit:result.isRepeatVisit}}
export async function mobileCheckout(user:MobilePrincipal,raw:unknown){await checkoutForUser(field(user),raw);return{ok:true}}
