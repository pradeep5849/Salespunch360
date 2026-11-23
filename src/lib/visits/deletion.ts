import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {db} from '@/lib/db';
import {requireSalesWorkspaceForMutation} from '@/lib/auth/authorization';
import {canAccessSalesWorkspace} from '@/lib/auth/workspace-policy';
import {assertOperationalWrite} from '@/lib/billing/entitlement';
import {resolveOperationalWriteBranch} from '@/lib/branches/operational-scope';

export class VisitDeletionError extends Error {
 constructor(public code:'VISIT_NOT_FOUND'|'VISIT_LINKED'|'VISIT_CHANGED'|'FORBIDDEN'){super(code)}
}
export const deleteOwnVisitSchema=z.object({visitId:z.uuid(),revision:z.iso.datetime(),confirmed:z.literal(true)}).strict();
export async function deleteOwnVisit(raw:unknown){const user=await requireSalesWorkspaceForMutation();return deleteOwnVisitForActor(user,raw)}
/** Own unlinked corrections only. Lock in the same user -> visit order as check-in/checkout.
 * Never detach lead/follow-up/reference relationships to make a visit deletable. */
export async function deleteOwnVisitForActor(actor:{id:string;companyId:string},raw:unknown){
 const d=deleteOwnVisitSchema.parse(raw);
 await assertOperationalWrite(actor.companyId);
 try{return await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
  const user=await tx.user.findFirst({where:{id:actor.id,companyId:actor.companyId,isActive:true},select:{id:true,companyId:true,isActive:true,role:true,salesRole:true,accountRole:true,salesAccessActive:true,accountAccessActive:true,managerType:true}});
  const company=await tx.company.findUnique({where:{id:actor.companyId},select:{productEdition:true}});
  if(!user||!company||!canAccessSalesWorkspace(user,company.productEdition))throw new VisitDeletionError('FORBIDDEN');
  await tx.$queryRaw`SELECT id FROM customer_visits WHERE id=${d.visitId}::uuid AND "companyId"=${actor.companyId}::uuid AND "userId"=${actor.id}::uuid FOR UPDATE`;
  const visit=await tx.customerVisit.findFirst({where:{id:d.visitId,companyId:actor.companyId,userId:actor.id},include:{photo:true,completedFollowUpTask:{select:{id:true}}}});
  if(!visit)throw new VisitDeletionError('VISIT_NOT_FOUND');
  const access=await tx.user.findFirstOrThrow({where:{id:user.id},select:{branchAccessScope:true}});
  const allowed=await tx.branch.findMany({where:{companyId:actor.companyId,isActive:true,...(access.branchAccessScope==='SELECTED_BRANCHES'?{userAccesses:{some:{userId:actor.id}}}:{})},select:{id:true}});
  await resolveOperationalWriteBranch({...user,companyId:actor.companyId,branchAccessScope:access.branchAccessScope,branchIds:allowed.map(b=>b.id)},visit.branchId,tx);
  if(visit.updatedAt.toISOString()!==d.revision)throw new VisitDeletionError('VISIT_CHANGED');
  const [leads,customers]=await Promise.all([
   tx.lead.count({where:{companyId:actor.companyId,OR:[{sourceVisitId:visit.id},{checkInReferenceVisitId:visit.id}]}}),
   tx.customer.count({where:{companyId:actor.companyId,checkInReferenceVisitId:visit.id}}),
  ]);
  if(visit.leadId||visit.customerId||visit.completedFollowUpTask||leads||customers)throw new VisitDeletionError('VISIT_LINKED');
  const objects=visit.photo?[{companyId:actor.companyId,objectKey:visit.photo.objectKey},{companyId:actor.companyId,objectKey:visit.photo.thumbnailObjectKey}]:[];
  if(objects.length)await tx.pendingStorageDeletion.createMany({data:objects,skipDuplicates:true});
  await tx.visitPhoto.deleteMany({where:{visitId:visit.id,companyId:actor.companyId}});
  await tx.customerVisit.delete({where:{id:visit.id}});
  await tx.fieldJob.updateMany({where:{companyId:actor.companyId,key:{in:[`GEOCODE:${visit.id}`,`VISIT_CHECKOUT:${visit.id}`]},completedAt:null},data:{completedAt:new Date(),lastError:'VISIT_DELETED'}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId,actorUserId:actor.id,eventType:'OWN_UNLINKED_VISIT_DELETED',entityType:'CUSTOMER_VISIT',entityId:visit.id,metadata:{wasActive:visit.checkedOutAt===null,photosQueued:objects.length}}});
  return {ok:true as const};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable})}
 catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2003','P2025'].includes(error.code))throw new VisitDeletionError('VISIT_CHANGED');throw error}

}
