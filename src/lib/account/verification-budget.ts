import type {Prisma} from '@prisma/client';
export const VERIFICATION_RECORD_LIMIT=10000;
export const VERIFICATION_RELATION_LIMIT=50000;
export async function verificationBudget(client:Prisma.TransactionClient,companyId:string,scope?:{financialYearId:string;startDate:Date;endDate:Date}){
 const journalWhere={companyId,...(scope?{financialYearId:scope.financialYearId}:{})};
 const period=(field:string)=>scope?{[field]:{gte:scope.startDate,lte:scope.endDate}}:{};
 const entries=await Promise.all([
  client.journalEntry.count({where:journalWhere}),
  client.journalLine.count({where:{companyId,journalEntry:journalWhere}}),
  client.commercialDocument.count({where:{companyId,...period('issueDate')}}),
  client.ledgerAccount.count({where:{companyId,systemKey:{not:null}}}),
  client.moneyAccount.count({where:{companyId}}),
  client.stockMovement.count({where:{companyId,...period('movementDate')}}),
  client.project.count({where:{companyId}}),
  client.asset.count({where:{companyId}}),
  client.assetAssignmentHistory.count({where:{companyId,returnedAt:null}}),
  client.warehouse.count({where:{companyId}}),
  client.user.count({where:{companyId}}),
  client.userBranchAccess.count({where:{user:{companyId}}}),
  client.branch.count({where:{companyId}}),
  client.customer.count({where:{companyId}}),
 ]);
 const labels=['Journals','Journal lines','Documents','System ledger mappings','Money accounts','Stock movements','Projects','Assets','Open asset assignments','Warehouses','Users','User branch assignments','Branches','Customers'];
 return entries.map((count,index)=>({label:labels[index],count,limit:index===1||index===11?VERIFICATION_RELATION_LIMIT:VERIFICATION_RECORD_LIMIT})).filter(row=>row.count>row.limit);
}
