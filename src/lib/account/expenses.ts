import { randomUUID } from "node:crypto";
import {
  ExpenseCategoryScope,
  ExpenseTransactionStatus,
  ExpenseTransactionType,
  Prisma,
  RecurringFrequency,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "./modules";
import {
  authorizedProjectBranchIds,
  projectRecordScope,
  type ProjectActor,
} from "./projects";
import { allocateDocumentNumberInTx } from "./numbering";
import {
  postJournalInTx,
  reverseJournal,
  reverseJournalForActor,
} from "@/lib/accounting/service";
import { privateStorage } from "@/lib/storage";
import { calculateTax } from "./tax";
const D = Prisma.Decimal,
  Z = new D(0),
  money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/);
export function expensePosting(input: {
  type: "PROJECT_EXPENSE" | "OFFICE_EXPENSE" | "OTHER_INCOME" | "REIMBURSEMENT";
  taxable: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  categoryLedgerId: string;
  inputTaxLedgerId: string;
  destinationLedgerId: string;
}) {
  if (input.taxable.lte(0) || input.taxRate.lt(0))
    throw new Error("INVALID_EXPENSE_AMOUNT");
  if (input.type === "OTHER_INCOME" && input.taxRate.gt(0))
    throw new Error("OTHER_INCOME_TAX_REQUIRES_A12");
  const tax = input.taxable.mul(input.taxRate).div(100).toDecimalPlaces(2),
    total = input.taxable.add(tax);
  return input.type === "OTHER_INCOME"
    ? {
        total,
        lines: [
          {
            ledgerAccountId: input.destinationLedgerId,
            debit: total,
            credit: Z,
          },
          { ledgerAccountId: input.categoryLedgerId, debit: Z, credit: total },
        ],
      }
    : {
        total,
        lines: [
          {
            ledgerAccountId: input.categoryLedgerId,
            debit: input.taxable,
            credit: Z,
          },
          ...(tax.gt(0)
            ? [
                {
                  ledgerAccountId: input.inputTaxLedgerId,
                  debit: tax,
                  credit: Z,
                },
              ]
            : []),
          {
            ledgerAccountId: input.destinationLedgerId,
            debit: Z,
            credit: total,
          },
        ],
      };
}
export const requiresExpenseApproval = (
  total: Prisma.Decimal,
  required: boolean,
  threshold: Prisma.Decimal,
) => required && total.gt(threshold);
async function approvalRequired(
  tx: Prisma.TransactionClient,
  companyId: string,
  total: Prisma.Decimal,
) {
  const settings = await tx.accountSettings.findUnique({
    where: { companyId },
  });
  return requiresExpenseApproval(
    total,
    settings?.expenseApprovalRequired ?? false,
    settings?.expenseApprovalThreshold ?? Z,
  );
}
export const recurringOccurrenceKey = (templateId: string, due: Date) =>
  `${templateId}:${due.toISOString().slice(0, 10)}`;
type Actor = ProjectActor;
async function actor(
  permission:
    | "ACCOUNT_EXPENSE_VIEW"
    | "ACCOUNT_EXPENSE_ENTRY"
    | "ACCOUNT_EXPENSE_APPROVE",
  mutation = false,
) {
  const a = (
    mutation
      ? await requirePermissionForMutation(permission)
      : await requirePermission(permission)
  ) as Actor;
  await requireAccountModules(a, "EXPENSES");
  return a;
}
const branchOk = (a: Actor, id: string) =>
  a.branchAccessScope !== "SELECTED_BRANCHES" || a.branchIds?.includes(id);
async function expenseRecordScope(
  a: Actor,
): Promise<Prisma.ExpenseTransactionWhereInput> {
  const branchIds = await authorizedProjectBranchIds(a);
  const branchScope =
    a.branchAccessScope === "SELECTED_BRANCHES"
      ? { branchId: { in: branchIds } }
      : {};
  if (a.accountRole !== "PROJECT_MANAGER")
    return { companyId: a.companyId, ...branchScope };
  const projects = await db.project.findMany({
    where: projectRecordScope(a, branchIds),
    select: { id: true },
  });
  return {
    companyId: a.companyId,
    type: { in: ["PROJECT_EXPENSE", "REIMBURSEMENT"] },
    projectId: { in: projects.map((project) => project.id) },
  };
}
async function scopedExpense(
  a: Actor,
  id: string,
  status?: ExpenseTransactionStatus,
) {
  const row = await db.expenseTransaction.findFirst({
    where: {
      id,
      ...(await expenseRecordScope(a)),
      ...(status ? { status } : {}),
    },
  });
  if (!row) throw new AuthorizationError();
  return row;
}
async function audit(
  tx: Prisma.TransactionClient,
  a: Actor,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.accountOperationalAudit.create({
    data: {
      companyId: a.companyId,
      actorUserId: a.id,
      eventType,
      entityType,
      entityId,
      metadata,
    },
  });
}
const categoryInput = z.object({
  name: z.string().trim().min(1).max(160),
  scope: z.nativeEnum(ExpenseCategoryScope),
  defaultLedgerAccountId: z.string().uuid(),
});
export async function saveExpenseCategory(raw: unknown, id?: string) {
  const a = await actor("ACCOUNT_EXPENSE_APPROVE", true);
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const d = categoryInput.parse(raw),
    ledger = await db.ledgerAccount.findFirst({
      where: {
        id: d.defaultLedgerAccountId,
        companyId: a.companyId,
        isActive: true,
        allowPosting: true,
        accountClass: d.scope === "INCOME" ? "INCOME" : "EXPENSE",
      },
    });
  if (!ledger) throw new Error("INVALID_CATEGORY_LEDGER");
  if (id) {
    const changed = await db.expenseCategory.updateMany({
      where: { id, companyId: a.companyId },
      data: d,
    });
    if (changed.count !== 1) throw new AuthorizationError();
    return;
  }
  return db.expenseCategory.create({ data: { ...d, companyId: a.companyId } });
}
export async function deactivateExpenseCategory(id: string) {
  const a = await actor("ACCOUNT_EXPENSE_APPROVE", true);
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const changed = await db.expenseCategory.updateMany({
    where: { id, companyId: a.companyId },
    data: { isActive: false },
  });
  if (changed.count !== 1) throw new AuthorizationError();
}
const expenseInput = z
  .object({
    branchId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    categoryId: z.string().uuid(),
    type: z.nativeEnum(ExpenseTransactionType),
    transactionDate: z.coerce.date(),
    taxableAmount: money,
    taxRate: money.default("0"),
    cessRate: money.default("0"),
    taxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]).default("EXCLUSIVE"),
    stateOfSupplyCode: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
    taxCreditTreatment: z
      .enum(["ELIGIBLE", "INELIGIBLE", "BLOCKED"])
      .default("ELIGIBLE"),
    moneyAccountId: z.string().uuid().optional(),
    employeeReimbursementId: z.string().uuid().optional(),
    reference: z.string().max(160).optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();
async function validateExpenseRelations(
  a: Actor,
  d: z.infer<typeof expenseInput>,
) {
  if (
    !branchOk(a, d.branchId) ||
    !(await db.branch.findFirst({
      where: { id: d.branchId, companyId: a.companyId, isActive: true },
    }))
  )
    throw new Error("INVALID_BRANCH");
  const category = await db.expenseCategory.findFirst({
    where: { id: d.categoryId, companyId: a.companyId, isActive: true },
  });
  if (!category) throw new Error("INVALID_EXPENSE_CATEGORY");
  if (
    a.accountRole === "PROJECT_MANAGER" &&
    !["PROJECT_EXPENSE", "REIMBURSEMENT"].includes(d.type)
  )
    throw new AuthorizationError();
  if (d.type === "OTHER_INCOME" && new D(d.taxRate).gt(0))
    throw new Error("OTHER_INCOME_TAX_REQUIRES_A12");
  const ledger = await db.ledgerAccount.findFirst({
      where: {
        id: category.defaultLedgerAccountId,
        companyId: a.companyId,
        isActive: true,
        allowPosting: true,
      },
    }),
    income = d.type === "OTHER_INCOME";
  if (
    !ledger ||
    (category.scope !== (income ? "INCOME" : "EXPENSE") &&
      category.scope !== "BOTH") ||
    ledger.accountClass !== (income ? "INCOME" : "EXPENSE")
  )
    throw new Error("EXPENSE_CATEGORY_CLASS_MISMATCH");
  if (d.type === "PROJECT_EXPENSE" && !d.projectId)
    throw new Error("PROJECT_REQUIRED");
  if (d.projectId) {
    await requireAccountModules(a, "PROJECTS");
    const ids = await authorizedProjectBranchIds(a),
      project = await db.project.findFirst({
        where: {
          id: d.projectId,
          branchId: d.branchId,
          status: { notIn: ["CLOSED", "CANCELLED"] },
          ...projectRecordScope(a, ids),
        },
      });
    if (!project) throw new AuthorizationError();
  }
  if (d.type !== "REIMBURSEMENT" && !d.moneyAccountId)
    throw new Error("MONEY_ACCOUNT_REQUIRED");
  if (
    d.moneyAccountId &&
    !(await db.moneyAccount.findFirst({
      where: {
        id: d.moneyAccountId,
        companyId: a.companyId,
        isActive: true,
        OR: [{ branchId: null }, { branchId: d.branchId }],
      },
    }))
  )
    throw new Error("INVALID_MONEY_ACCOUNT");
  if (
    d.employeeReimbursementId &&
    !(await db.employeeReimbursement.findFirst({
      where: {
        id: d.employeeReimbursementId,
        companyId: a.companyId,
        branchId: d.branchId,
        status: "APPROVED",
      },
    }))
  )
    throw new Error("INVALID_REIMBURSEMENT");
  return category;
}
export async function createExpenseForActor(
  a: Actor,
  raw: unknown,
  occurrenceKey?: string,
) {
  const d = expenseInput.parse(raw),
    category = await validateExpenseRelations(a, d),
    inputAmount = new D(d.taxableAmount),
    context = await db.branch.findFirst({
      where: { id: d.branchId, companyId: a.companyId },
      select: { gstStateCode: true },
    }),
    settings = await db.accountSettings.findUnique({
      where: { companyId: a.companyId! },
    }),
    calculated = calculateTax({
      amount: inputAmount,
      taxRate: new D(d.taxRate),
      cessRate: new D(d.cessRate),
      taxMode: d.taxMode,
      sellerStateCode: context?.gstStateCode ?? settings?.defaultStateCode,
      stateOfSupplyCode:
        d.stateOfSupplyCode ??
        context?.gstStateCode ??
        settings?.defaultStateCode,
      itcEligible: d.taxCreditTreatment === "ELIGIBLE",
      composition: settings?.compositionEnabled,
    }),
    taxable = calculated.taxable,
    tax = calculated.totalTax,
    total = calculated.grandTotal;
  return db.$transaction(
    async (tx) => {
      const transactionNumber = await allocateDocumentNumberInTx(tx, {
          companyId: a.companyId,
          branchId: d.branchId,
          seriesKey: "EXPENSE",
          defaults: {
            prefix: d.type === "OTHER_INCOME" ? "OI-" : "EXP-",
            padding: 6,
          },
        }),
        row = await tx.expenseTransaction.create({
          data: {
            ...d,
            companyId: a.companyId,
            transactionNumber,
            taxableAmount: taxable,
            taxRate: new D(d.taxRate),
            taxAmount: tax,
            cgstAmount: calculated.cgst,
            sgstAmount: calculated.sgst,
            igstAmount: calculated.igst,
            cessAmount: calculated.cess,
            totalAmount: total,
            status: "DRAFT",
            approvedAt: null,
            approvedById: null,
            occurrenceKey,
            createdById: a.id,
          },
        });
      await audit(tx, a, "EXPENSE_CREATED", "EXPENSE", row.id, {
        categoryId: category.id,
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function updateExpenseForActor(
  a: Actor,
  id: string,
  raw: unknown,
) {
  await scopedExpense(a, id, "DRAFT");
  const d = expenseInput.parse(raw);
  await validateExpenseRelations(a, d);
  const [branch, settings] = await Promise.all([
      db.branch.findFirst({
        where: { id: d.branchId, companyId: a.companyId },
      }),
      db.accountSettings.findUnique({ where: { companyId: a.companyId! } }),
    ]),
    calculated = calculateTax({
      amount: new D(d.taxableAmount),
      taxRate: new D(d.taxRate),
      cessRate: new D(d.cessRate),
      taxMode: d.taxMode,
      sellerStateCode: branch?.gstStateCode ?? settings?.defaultStateCode,
      stateOfSupplyCode:
        d.stateOfSupplyCode ??
        branch?.gstStateCode ??
        settings?.defaultStateCode,
      composition: settings?.compositionEnabled,
      itcEligible: d.taxCreditTreatment === "ELIGIBLE",
    }),
    changed = await db.expenseTransaction.updateMany({
      where: { id, companyId: a.companyId, status: "DRAFT", createdById: a.id },
      data: {
        ...d,
        taxableAmount: calculated.taxable,
        taxRate: new D(d.taxRate),
        taxAmount: calculated.totalTax,
        cgstAmount: calculated.cgst,
        sgstAmount: calculated.sgst,
        igstAmount: calculated.igst,
        cessAmount: calculated.cess,
        totalAmount: calculated.grandTotal,
      },
    });
  if (changed.count !== 1) throw new Error("EXPENSE_NOT_EDITABLE");
}
export async function transitionExpenseForActor(
  a: Actor,
  id: string,
  to: ExpenseTransactionStatus,
) {
  await scopedExpense(a, id);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "expense_transactions" WHERE "id"=${id}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
      const row = await tx.expenseTransaction.findFirst({
        where: { id, companyId: a.companyId },
      });
      if (!row) throw new AuthorizationError();
      if (
        a.accountRole === "PROJECT_MANAGER" &&
        ["APPROVED", "REJECTED"].includes(to)
      )
        throw new AuthorizationError();
      const allowed: Partial<
        Record<ExpenseTransactionStatus, ExpenseTransactionStatus[]>
      > = {
        DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
        PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
      };
      if (!allowed[row.status]?.includes(to))
        throw new Error("INVALID_EXPENSE_TRANSITION");
      if (
        ["APPROVED", "REJECTED"].includes(to) &&
        a.accountRole !== "ACCOUNT_ADMIN"
      )
        throw new AuthorizationError();
      const effectiveTo =
        row.status === "DRAFT" &&
        to === "PENDING_APPROVAL" &&
        !(await approvalRequired(tx, a.companyId, row.totalAmount))
          ? "APPROVED"
          : to;
      const updated = await tx.expenseTransaction.update({
        where: { id },
        data: {
          status: effectiveTo,
          ...(effectiveTo === "APPROVED" && to === "APPROVED"
            ? { approvedById: a.id, approvedAt: new Date() }
            : {}),
        },
      });
      await audit(tx, a, `EXPENSE_${effectiveTo}`, "EXPENSE", id, {
        explicitApproval: to === "APPROVED",
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function postExpenseForActor(a: Actor, id: string) {
  if (!["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(a.accountRole ?? ""))
    throw new AuthorizationError();
  await scopedExpense(a, id);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "expense_transactions" WHERE "id"=${id}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
      const row = await tx.expenseTransaction.findFirst({
        where: { id, companyId: a.companyId },
      });
      if (!row) throw new AuthorizationError();
      if (row.status === "POSTED" && row.journalEntryId)
        return tx.journalEntry.findFirstOrThrow({
          where: { id: row.journalEntryId, companyId: a.companyId },
        });
      if (row.status !== "APPROVED") throw new Error("EXPENSE_NOT_APPROVED");
      const [category, money, fy, system] = await Promise.all([
        tx.expenseCategory.findFirst({
          where: { id: row.categoryId, companyId: a.companyId, isActive: true },
        }),
        row.moneyAccountId
          ? tx.moneyAccount.findFirst({
              where: {
                id: row.moneyAccountId,
                companyId: a.companyId,
                isActive: true,
              },
            })
          : null,
        tx.financialYear.findFirst({
          where: {
            companyId: a.companyId,
            isActive: true,
            startDate: { lte: row.transactionDate },
            endDate: { gte: row.transactionDate },
          },
        }),
        tx.ledgerAccount.findMany({
          where: {
            companyId: a.companyId,
            systemKey: {
              in: [
                "INPUT_TAX_CREDIT",
                "ACCOUNTS_PAYABLE",
                "CGST_ITC",
                "SGST_ITC",
                "IGST_ITC",
                "CESS_ITC",
              ],
            },
            isActive: true,
            allowPosting: true,
          },
        }),
      ]);
      if (!category || !fy) throw new Error("EXPENSE_POSTING_CONTEXT_INVALID");
      const byKey = new Map(system.map((x) => [x.systemKey, x.id])),
        destination = money?.ledgerAccountId ?? byKey.get("ACCOUNTS_PAYABLE");
      if (!destination) throw new Error("EXPENSE_DESTINATION_MISSING");
      const eligible = row.taxCreditTreatment === "ELIGIBLE",
        components = [
          ["CGST_ITC", row.cgstAmount],
          ["SGST_ITC", row.sgstAmount],
          ["IGST_ITC", row.igstAmount],
          ["CESS_ITC", row.cessAmount],
        ] as const,
        postingLines =
          row.type === "OTHER_INCOME"
            ? [
                {
                  ledgerAccountId: destination,
                  debit: row.totalAmount,
                  credit: Z,
                },
                {
                  ledgerAccountId: category.defaultLedgerAccountId,
                  debit: Z,
                  credit: row.totalAmount,
                },
              ]
            : [
                {
                  ledgerAccountId: category.defaultLedgerAccountId,
                  debit: row.taxableAmount.add(eligible ? Z : row.taxAmount),
                  credit: Z,
                },
                ...components
                  .filter(([, amount]) => eligible && amount.gt(0))
                  .map(([key, amount]) => ({
                    ledgerAccountId: byKey.get(key) ?? "",
                    debit: amount,
                    credit: Z,
                  })),
                {
                  ledgerAccountId: destination,
                  debit: Z,
                  credit: row.totalAmount,
                },
              ],
        journal = await postJournalInTx(tx, a, {
          financialYearId: fy.id,
          branchId: row.branchId,
          entryDate: row.transactionDate,
          reference: row.reference,
          narration: row.notes,
          sourceType: row.type,
          sourceId: row.id,
          postingPurpose: "PRIMARY",
          lines: postingLines.map((l) => ({
            ledgerAccountId: l.ledgerAccountId,
            debit: l.debit.toFixed(2),
            credit: l.credit.toFixed(2),
          })),
        }),
        changed = await tx.expenseTransaction.updateMany({
          where: {
            id: row.id,
            companyId: a.companyId,
            status: "APPROVED",
            journalEntryId: null,
          },
          data: { status: "POSTED", journalEntryId: journal.id },
        });
      if (changed.count !== 1) throw new Error("STALE_EXPENSE");
      await audit(
        tx,
        a,
        row.type === "OTHER_INCOME" ? "OTHER_INCOME_POSTED" : "EXPENSE_POSTED",
        "EXPENSE",
        row.id,
        { journalEntryId: journal.id },
      );
      return journal;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
export async function reverseExpenseForActor(
  a: Actor,
  id: string,
  entryDate: Date,
  reason: string,
) {
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new AuthorizationError();
  const row = await scopedExpense(a, id, "POSTED");
  if (!row?.journalEntryId) throw new Error("EXPENSE_NOT_REVERSIBLE");
  const reversal = await reverseJournalForActor(a, {
    journalEntryId: row.journalEntryId,
    entryDate,
    reason,
  });
  await db.$transaction(async (tx) => {
    const changed = await tx.expenseTransaction.updateMany({
      where: {
        id,
        companyId: a.companyId,
        status: "POSTED",
        reversalJournalId: null,
      },
      data: { status: "REVERSED", reversalJournalId: reversal.id },
    });
    if (changed.count !== 1) throw new Error("EXPENSE_ALREADY_REVERSED");
    await audit(tx, a, "EXPENSE_REVERSED", "EXPENSE", id, {
      reversalJournalId: reversal.id,
    });
  });
  return reversal;
}
export async function listExpensesForActor(a: Actor) {
  return db.expenseTransaction.findMany({
    where: await expenseRecordScope(a),
    orderBy: { transactionDate: "desc" },
    take: 200,
  });
}
export async function getExpenseForActor(a: Actor, id: string) {
  return scopedExpense(a, id);
}
export async function expenseOptionsForActor(a: Actor) {
  const branchIds = await authorizedProjectBranchIds(a),
    projectScope = projectRecordScope(a, branchIds);
  return {
    categories: await db.expenseCategory.findMany({
      where: { companyId: a.companyId, isActive: true },
    }),
    branches: await db.branch.findMany({
      where: { companyId: a.companyId, id: { in: branchIds }, isActive: true },
    }),
    moneyAccounts: await db.moneyAccount.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        OR: [{ branchId: null }, { branchId: { in: branchIds } }],
      },
    }),
    projects: await db.project.findMany({
      where: { status: { notIn: ["CLOSED", "CANCELLED"] }, ...projectScope },
    }),
  };
}
const templateInput = z.object({
  branchId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  categoryId: z.string().uuid(),
  frequency: z.nativeEnum(RecurringFrequency),
  nextDueDate: z.coerce.date(),
  amount: money,
});
export async function createRecurringTemplateForActor(a: Actor, raw: unknown) {
  const d = templateInput.parse(raw);
  if (
    !branchOk(a, d.branchId) ||
    !(await db.branch.findFirst({
      where: { id: d.branchId, companyId: a.companyId, isActive: true },
    }))
  )
    throw new AuthorizationError();
  const category = await db.expenseCategory.findFirst({
    where: { id: d.categoryId, companyId: a.companyId, isActive: true },
  });
  if (!category) throw new Error("INVALID_EXPENSE_CATEGORY");
  const ledger = await db.ledgerAccount.findFirst({
    where: {
      id: category.defaultLedgerAccountId,
      companyId: a.companyId,
      isActive: true,
      allowPosting: true,
      accountClass: "EXPENSE",
    },
  });
  if (!ledger || !["EXPENSE", "BOTH"].includes(category.scope))
    throw new Error("EXPENSE_CATEGORY_CLASS_MISMATCH");
  if (a.accountRole === "PROJECT_MANAGER" && !d.projectId)
    throw new AuthorizationError();
  if (d.projectId) {
    const ids = await authorizedProjectBranchIds(a);
    if (
      !(await db.project.findFirst({
        where: {
          id: d.projectId,
          branchId: d.branchId,
          status: { notIn: ["CLOSED", "CANCELLED"] },
          ...projectRecordScope(a, ids),
        },
      }))
    )
      throw new AuthorizationError();
  }
  return db.recurringExpenseTemplate.create({
    data: {
      ...d,
      amount: new D(d.amount),
      companyId: a.companyId,
      createdById: a.id,
    },
  });
}
const next = (date: Date, f: RecurringFrequency) => {
  const x = new Date(date);
  if (f === "WEEKLY") x.setUTCDate(x.getUTCDate() + 7);
  else if (f === "MONTHLY") x.setUTCMonth(x.getUTCMonth() + 1);
  else if (f === "QUARTERLY") x.setUTCMonth(x.getUTCMonth() + 3);
  else x.setUTCFullYear(x.getUTCFullYear() + 1);
  return x;
};
export async function generateRecurringExpense(
  templateId: string,
  moneyAccountId: string,
) {
  const a = await actor("ACCOUNT_EXPENSE_ENTRY", true);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "recurring_expense_templates" WHERE "id"=${templateId}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
      const t = await tx.recurringExpenseTemplate.findFirst({
        where: { id: templateId, companyId: a.companyId, isActive: true },
      });
      if (!t || !branchOk(a, t.branchId)) throw new AuthorizationError();
      if (
        !(await tx.branch.findFirst({
          where: { id: t.branchId, companyId: a.companyId, isActive: true },
        })) ||
        (a.accountRole === "PROJECT_MANAGER" && !t.projectId)
      )
        throw new AuthorizationError();
      if (t.projectId) {
        const ids = await authorizedProjectBranchIds(a);
        if (
          !(await tx.project.findFirst({
            where: {
              id: t.projectId,
              branchId: t.branchId,
              status: { notIn: ["CLOSED", "CANCELLED"] },
              ...projectRecordScope(a, ids),
            },
          }))
        )
          throw new AuthorizationError();
      }
      const category = await tx.expenseCategory.findFirst({
        where: { id: t.categoryId, companyId: a.companyId, isActive: true },
      });
      if (!category) throw new Error("INVALID_EXPENSE_CATEGORY");
      if (
        !["EXPENSE", "BOTH"].includes(category.scope) ||
        !(await tx.ledgerAccount.findFirst({
          where: {
            id: category.defaultLedgerAccountId,
            companyId: a.companyId,
            isActive: true,
            allowPosting: true,
            accountClass: "EXPENSE",
          },
        }))
      )
        throw new Error("EXPENSE_CATEGORY_CLASS_MISMATCH");
      const key = recurringOccurrenceKey(t.id, t.nextDueDate),
        existing = await tx.expenseTransaction.findFirst({
          where: { companyId: a.companyId, occurrenceKey: key },
        });
      if (existing) return existing;
      const number = await allocateDocumentNumberInTx(tx, {
          companyId: a.companyId,
          branchId: t.branchId,
          seriesKey: "EXPENSE",
          defaults: { prefix: "EXP-", padding: 6 },
        }),
        money = await tx.moneyAccount.findFirst({
          where: {
            id: moneyAccountId,
            companyId: a.companyId,
            isActive: true,
            OR: [{ branchId: null }, { branchId: t.branchId }],
          },
        });
      if (!money) throw new Error("INVALID_MONEY_ACCOUNT");
      const needsApproval = await approvalRequired(tx, a.companyId, t.amount);
      const row = await tx.expenseTransaction.create({
        data: {
          companyId: a.companyId,
          branchId: t.branchId,
          projectId: t.projectId,
          categoryId: t.categoryId,
          type: t.projectId ? "PROJECT_EXPENSE" : "OFFICE_EXPENSE",
          status: needsApproval ? "PENDING_APPROVAL" : "DRAFT",
          transactionNumber: number,
          transactionDate: t.nextDueDate,
          taxableAmount: t.amount,
          taxAmount: Z,
          taxRate: Z,
          totalAmount: t.amount,
          moneyAccountId,
          occurrenceKey: key,
          createdById: a.id,
        },
      });
      await tx.recurringExpenseTemplate.update({
        where: { id: t.id },
        data: { nextDueDate: next(t.nextDueDate, t.frequency) },
      });
      await audit(tx, a, "RECURRING_OCCURRENCE_CREATED", "EXPENSE", row.id, {
        templateId: t.id,
      });
      return row;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);
export async function addExpenseAttachmentForActor(
  a: Actor,
  expenseId: string,
  file: File,
) {
  if (!file.size || file.size > 10 * 1024 * 1024 || !allowedMime.has(file.type))
    throw new Error("INVALID_EXPENSE_ATTACHMENT");
  await scopedExpense(a, expenseId);
  const id = randomUUID(),
    key = `companies/${a.companyId}/expenses/${expenseId}/${id}`;
  await privateStorage().put(key, Buffer.from(await file.arrayBuffer()));
  try {
    return await db.$transaction(async (tx) => {
      const row = await tx.expenseAttachment.create({
        data: {
          id,
          companyId: a.companyId,
          expenseId,
          storageKey: key,
          displayName: file.name.slice(0, 240),
          mimeType: file.type,
          sizeBytes: file.size,
          uploadedById: a.id,
        },
      });
      await audit(tx, a, "ATTACHMENT_ADDED", "EXPENSE", expenseId, {
        attachmentId: id,
      });
      return row;
    });
  } catch (e) {
    await privateStorage()
      .delete(key)
      .catch(() => undefined);
    throw e;
  }
}
export async function downloadExpenseAttachmentForActor(a: Actor, id: string) {
  const row = await db.expenseAttachment.findFirst({
    where: { id, companyId: a.companyId },
  });
  if (!row) throw new AuthorizationError();
  await scopedExpense(a, row.expenseId);
  return {
    data: await privateStorage().get(row.storageKey),
    name: row.displayName,
    mimeType: row.mimeType,
  };
}

export async function createExpense(raw: unknown, occurrenceKey?: string) {
  return createExpenseForActor(
    await actor("ACCOUNT_EXPENSE_ENTRY", true),
    raw,
    occurrenceKey,
  );
}
export async function updateExpense(id: string, raw: unknown) {
  return updateExpenseForActor(
    await actor("ACCOUNT_EXPENSE_ENTRY", true),
    id,
    raw,
  );
}
export async function transitionExpense(
  id: string,
  to: ExpenseTransactionStatus,
) {
  const p = ["APPROVED", "REJECTED"].includes(to)
    ? "ACCOUNT_EXPENSE_APPROVE"
    : "ACCOUNT_EXPENSE_ENTRY";
  return transitionExpenseForActor(await actor(p, true), id, to);
}
export async function postExpense(id: string) {
  return postExpenseForActor(await actor("ACCOUNT_EXPENSE_ENTRY", true), id);
}
export async function reverseExpense(
  id: string,
  entryDate: Date,
  reason: string,
) {
  return reverseExpenseForActor(
    await actor("ACCOUNT_EXPENSE_APPROVE", true),
    id,
    entryDate,
    reason,
  );
}
export async function listExpenses() {
  return listExpensesForActor(await actor("ACCOUNT_EXPENSE_VIEW"));
}
export async function getExpense(id: string) {
  return getExpenseForActor(await actor("ACCOUNT_EXPENSE_VIEW"), id);
}
export async function expenseOptions() {
  return expenseOptionsForActor(await actor("ACCOUNT_EXPENSE_VIEW"));
}
export async function createRecurringTemplate(raw: unknown) {
  return createRecurringTemplateForActor(
    await actor("ACCOUNT_EXPENSE_ENTRY", true),
    raw,
  );
}
export async function addExpenseAttachment(expenseId: string, file: File) {
  return addExpenseAttachmentForActor(
    await actor("ACCOUNT_EXPENSE_ENTRY", true),
    expenseId,
    file,
  );
}
export async function downloadExpenseAttachment(id: string) {
  return downloadExpenseAttachmentForActor(
    await actor("ACCOUNT_EXPENSE_VIEW"),
    id,
  );
}
