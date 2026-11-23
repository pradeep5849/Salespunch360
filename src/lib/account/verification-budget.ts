import type {Prisma} from '@prisma/client';
export const VERIFICATION_RECORD_LIMIT=10000;
export const VERIFICATION_RELATION_LIMIT=50000;
export async function verificationBudget(client:Prisma.TransactionClient,companyId:string,scope?:{financialYearId:string;startDate:Date;endDate:Date}){
 const journalWhere={companyId,...(scope?{financialYearId:scope.financialYearId}:{})};
 const period=(field:string)=>scope?{[field]:{gte:scope.startDate,lte:scope.endDate}}:{};
 const documentWhere={companyId,status:'POSTED' as const,...period('issueDate')},settlementWhere={companyId,...period('transactionDate')};
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
  client.commercialDocumentLine.count({where:{companyId,document:documentWhere}}),
  client.accountSettlement.count({where:settlementWhere}),
  client.settlementAllocation.count({where:{companyId,OR:[{document:documentWhere},{settlement:settlementWhere}]}}),
  client.advanceApplication.count({where:{companyId,OR:[{document:documentWhere},{advance:settlementWhere}]}}),
  client.openingBalanceAllocation.count({where:{companyId,settlement:settlementWhere}}),
  client.financialYear.count({where:{companyId,...(scope?{id:scope.financialYearId}:{})}}),
  client.saleRevisionCredit.count({where:{companyId,revision:{invoice:documentWhere}}}),
  client.commercialDocument.count({where:{companyId,sourceDocument:documentWhere}}),
 ]);
 const labels=['Journals','Journal lines','Documents','System ledger mappings','Money accounts','Stock movements','Projects','Assets','Open asset assignments','Warehouses','Users','User branch assignments','Branches','Customers','Posted document lines','Settlements','Settlement allocations','Advance applications','Opening allocations','Financial years','Retained revision credits','Posted document adjustments'];
 return entries.map((count,index)=>({label:labels[index],count,limit:[1,11,14,16,17,18,20,21].includes(index)?VERIFICATION_RELATION_LIMIT:VERIFICATION_RECORD_LIMIT})).filter(row=>row.count>row.limit);
}
