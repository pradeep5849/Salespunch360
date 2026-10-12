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
  const owners = await db.ownerFinancialAccount.findMany({
    where: { companyId: actor.companyId },
    select: { capitalLedgerId: true },
  });
  const balances = await db.journalLine.aggregate({
    where: {
      companyId: actor.companyId,
      ledgerAccountId: { in: owners.map((owner) => owner.capitalLedgerId) },
      journalEntry: {
        status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
        ...(actor.branchAccessScope === "SELECTED_BRANCHES"
          ? { branchId: { in: actor.branchIds ?? [] } }
          : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });
  return {
    ownerCount: owners.length,
    capital: new Prisma.Decimal(balances._sum.credit ?? 0)
      .sub(balances._sum.debit ?? 0)
      .toFixed(2),
  };
}
