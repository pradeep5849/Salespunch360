import type {Prisma} from '@prisma/client';
import {indiaDateText,parseIndiaBusinessDate} from './date';
/** Status is presentation only; every caller must additionally apply actor and branch scope. */
export function followUpStatusWhere(status:string,now=new Date()):Prisma.FollowUpTaskWhereInput{
 const today=parseIndiaBusinessDate(indiaDateText(now)),tomorrow=new Date(today.getTime()+86400000);
 switch(status){
  case 'ALL':return {};
  case 'OVERDUE':return {status:'PENDING',dueDate:{lt:today}};
  case 'TODAY':return {status:'PENDING',dueDate:{gte:today,lt:tomorrow}};
  case 'UPCOMING':return {status:'PENDING',dueDate:{gte:tomorrow}};
  case 'CLOSED':case 'COMPLETED':return {status:'COMPLETED'};
  case 'CANCELLED':return {status:'CANCELLED'};
  default:return {status:'PENDING'};
 }
}
