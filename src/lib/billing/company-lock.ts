import type {Prisma} from '@prisma/client';

/** Common first lock for every mutation that changes or consumes Sales seats. */
export async function lockBillingCompany(tx:Prisma.TransactionClient,companyId:string){
 await tx.$queryRaw`SELECT 1::int AS "locked" FROM "companies" WHERE "id"=${companyId}::uuid FOR UPDATE`;
 const company=await tx.company.findUnique({where:{id:companyId},select:{id:true,teamStructure:true,productEdition:true,subscriptionStatus:true,trialStartedAt:true,trialEndsAt:true}});
 if(!company)throw new Error('NOT_FOUND');
 return company;
}
