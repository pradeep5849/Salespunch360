import {sumPersistedMoney} from "./money-sum";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { LEDGER_EFFECTIVE_JOURNAL_STATUSES } from "@/lib/accounting/ledger-policy";
import type { ProjectActor } from "./projects";
/** Owner capital is a financing balance, never an addition to asset valuation. */
export async function ownerCapitalSummaryForActor(actor: ProjectActor) {
  if (
    !actor.isActive ||
    !actor.accountAccessActive ||
    !["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(actor.accountRole ?? "")
  )
    throw new AuthorizationError();
  return db.$transaction(async tx=>{
  const owners = await tx.ownerFinancialAccount.findMany({
    where: { companyId: actor.companyId },
    select: { capitalLedgerId: true },
  });
  const balances = await tx.journalLine.aggregate({
    where: {
      companyId: actor.companyId,
      ledgerAccountId: { in: owners.map((owner) => owner.capitalLedgerId) },
      journalEntry: {
        companyId:actor.companyId,
        status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
        ...(actor.branchAccessScope === "SELECTED_BRANCHES"
          ? { branchId: { in: actor.branchIds ?? [] } }
          : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });
  const assets=await tx.journalLine.aggregate({where:{companyId:actor.companyId,ledgerAccount:{companyId:actor.companyId,accountClass:"ASSET"},journalEntry:{companyId:actor.companyId,status:{in:[...LEDGER_EFFECTIVE_JOURNAL_STATUSES]},...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}},_sum:{debit:true,credit:true}});
  return {
    companyAssets:sumPersistedMoney([new Prisma.Decimal(assets._sum.debit??0),new Prisma.Decimal(assets._sum.credit??0).negated()]),
    ownerCount: owners.length,
    capital: sumPersistedMoney([new Prisma.Decimal(balances._sum.credit??0),new Prisma.Decimal(balances._sum.debit??0).negated()]),
  };
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
