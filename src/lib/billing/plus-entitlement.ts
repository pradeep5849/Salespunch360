import type {Prisma,ProductEdition} from '@prisma/client';
import {getTrialStatus} from '@/lib/trial/status';
import {ACCOUNT_PACKAGE_ORDER_PROVIDER} from './account-package';

/**
 * Plus can use Sales team administration only while its Account side is entitled:
 * the shared Plus trial, or at least one currently-active paid Account package.
 */
export async function assertPlusAccountEntitled(
 tx:Prisma.TransactionClient,
 companyId:string,
 company:{productEdition:ProductEdition;subscriptionStatus:'TRIAL'|'ACTIVE'|'EXPIRED'|'SUSPENDED';trialStartedAt:Date|null;trialEndsAt:Date|null;teamStructure:'MANAGERS_AND_SALES'|'SALES_ONLY'},
 now=new Date(),
){
 if(company.productEdition!=='SALESPUNCH360_PLUS')return;
 if(getTrialStatus(company,now).isInTrial)return;
 const account=await tx.companySubscription.findFirst({where:{companyId,status:'ACTIVE',startsAt:{lte:now},endsAt:{gt:now},OR:[{accountPackages:{gt:0}},{sourceOrder:{is:{provider:ACCOUNT_PACKAGE_ORDER_PROVIDER}}}]},select:{id:true}});
 if(!account)throw new Error('PLUS_ACCOUNT_SUBSCRIPTION_REQUIRED');
}
