import {randomUUID,timingSafeEqual} from 'node:crypto';
import {after} from 'next/server';
import type {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {reverseGeocode} from '@/lib/maps/reverse-geocode';
import {deliverFieldEvent,type FieldEvent} from '@/lib/push/service';
import {z} from 'zod';

export async function enqueueFieldEvent(tx:Prisma.TransactionClient,companyId:string,event:FieldEvent){
 const key=`${event.eventType}:${event.attendanceId??event.visitId}`;
 await tx.fieldJob.upsert({where:{key},create:{companyId,key,kind:'PUSH',payload:{...event,occurredAt:event.occurredAt.toISOString()}},update:{}});
}
export async function withAttendanceEvent<T extends{id:string;startedAt:Date;endedAt:Date|null}>(tx:Prisma.TransactionClient,companyId:string,actorUserId:string,eventType:'ATTENDANCE_STARTED'|'ATTENDANCE_ENDED',operation:Promise<T>){
 const attendance=await operation;
 await enqueueFieldEvent(tx,companyId,{eventType,actorUserId,attendanceId:attendance.id,occurredAt:eventType==='ATTENDANCE_STARTED'?attendance.startedAt:attendance.endedAt!});
 return attendance;
}
export async function enqueueVisitAddress(tx:Prisma.TransactionClient,companyId:string,visitId:string){
 await tx.fieldJob.upsert({where:{key:`GEOCODE:${visitId}`},create:{companyId,key:`GEOCODE:${visitId}`,kind:'GEOCODE',payload:{visitId}},update:{}});
}
const eventSchema=z.object({eventType:z.enum(['ATTENDANCE_STARTED','ATTENDANCE_ENDED','VISIT_CHECKOUT']),actorUserId:z.string().uuid(),attendanceId:z.string().uuid().optional(),visitId:z.string().uuid().optional(),occurredAt:z.coerce.date(),subject:z.string().optional(),sentiment:z.string().optional()});
export async function processFieldJobs(limit=10){
 const now=new Date();const jobs=await db.fieldJob.findMany({where:{completedAt:null,nextAttemptAt:{lte:now},OR:[{lockedUntil:null},{lockedUntil:{lt:now}}]},orderBy:[{nextAttemptAt:'asc'},{id:'asc'}],take:Math.max(1,Math.min(limit,50))});
 let completed=0;
 for(const job of jobs){
  const leaseToken=randomUUID();const claim=await db.fieldJob.updateMany({where:{id:job.id,completedAt:null,OR:[{lockedUntil:null},{lockedUntil:{lt:new Date()}}]},data:{leaseToken,lockedUntil:new Date(Date.now()+300000)}});
  if(!claim.count)continue;
  try{
   if(job.kind==='GEOCODE'){
    const {visitId}=z.object({visitId:z.string().uuid()}).parse(job.payload);
    const visit=await db.customerVisit.findFirst({where:{id:visitId,companyId:job.companyId,checkInAddress:null},select:{checkInLatitude:true,checkInLongitude:true}});
    if(visit){
     if(!process.env.GOOGLE_MAPS_SERVER_API_KEY)throw new Error('GEOCODE_NOT_CONFIGURED');
     const address=await reverseGeocode(visit.checkInLatitude,visit.checkInLongitude);
     if(!address)throw new Error('GEOCODE_UNAVAILABLE');
     await db.customerVisit.updateMany({where:{id:visitId,companyId:job.companyId,checkInAddress:null},data:{checkInAddress:address}});
    }
   }else if(job.kind==='PUSH'){
    const event=eventSchema.parse(job.payload);
    if(await db.user.findFirst({where:{id:event.actorUserId,companyId:job.companyId},select:{id:true}}))await deliverFieldEvent(event,new Date(),true,job.id);
   }else throw new Error('INVALID_JOB_TYPE');
   await db.fieldJob.updateMany({where:{id:job.id,leaseToken},data:{completedAt:new Date(),lockedUntil:null,leaseToken:null,lastError:null}});completed++;
  }catch(error){
   const message=error instanceof Error?error.message:'DELIVERY_FAILED';
   await db.fieldJob.updateMany({where:{id:job.id,leaseToken},data:{attempts:{increment:1},lastError:message.slice(0,500),lockedUntil:null,leaseToken:null,nextAttemptAt:new Date(Date.now()+Math.min(3600000,15000*2**Math.min(job.attempts,8)))}});
  }
 }
 return{processed:jobs.length,completed};
}
export function scheduleFieldJobs(){
 try{after(async()=>{try{await processFieldJobs()}catch{console.error('FIELD_JOB_DISPATCH_UNAVAILABLE')}})}catch{/* Non-request scripts use the maintenance runner. */}
}
export function authorizedJobRunner(header:string|null,secret=process.env.FIELD_JOB_SECRET){
 if(!secret||secret.length<32||!header)return false;
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(header);return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
