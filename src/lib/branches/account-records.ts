import type {Prisma} from "@prisma/client";

/** Account records keep their branch scope; do not deactivate a used branch. */
export async function branchHasAccountRecords(tx:Prisma.TransactionClient,companyId:string,branchId:string){
 const where={companyId,branchId};
 const counts=await Promise.all([
  tx.journalEntry.count({where}),tx.commercialDocument.count({where}),
  tx.accountSettlement.count({where}),tx.expenseTransaction.count({where}),
  tx.stockMovement.count({where}),tx.projectMaterialMovement.count({where}),
  tx.warehouse.count({where}),tx.asset.count({where}),tx.project.count({where}),
  tx.moneyAccount.count({where}),
 ]);
 return counts.some(count=>count>0);
}
