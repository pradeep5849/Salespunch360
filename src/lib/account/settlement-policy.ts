/** Outstanding and available-credit calculations recognize effective posted payments only. */
export const EFFECTIVE_SETTLEMENT = {
  status: "POSTED" as const,
  journalEntry: { is: { status: "POSTED" as const } },
};
export const EFFECTIVE_SETTLEMENT_ALLOCATION = {
  settlement: { is: EFFECTIVE_SETTLEMENT },
};
export const EFFECTIVE_ADVANCE_APPLICATION = {
  advance: { is: EFFECTIVE_SETTLEMENT },
  journalEntry: { is: { status: "POSTED" as const } },
};

/** A later reversal does not erase a payment from an earlier historical cutoff. */
export function postedJournalAt(asOf: Date): import("@prisma/client").Prisma.JournalEntryWhereInput {
  return {
    entryDate: { lte: asOf },
    OR: [
      { status: "POSTED" },
      { status: "REVERSED", reversedBy: { is: { entryDate: { gt: asOf } } } },
    ],
  };
}
export function effectiveSettlementAt(asOf: Date): import("@prisma/client").Prisma.AccountSettlementWhereInput {
  return {
    status: { in: ["POSTED", "REVERSED"] },
    transactionDate: { lte: asOf },
    journalEntry: { is: postedJournalAt(asOf) },
  };
}
export function effectiveAllocationAt(asOf: Date) {
  return { settlement: { is: effectiveSettlementAt(asOf) } };
}
export function effectiveAdvanceApplicationAt(asOf: Date): import("@prisma/client").Prisma.AdvanceApplicationWhereInput {
  return {
    applicationDate: { lte: asOf },
    advance: { is: effectiveSettlementAt(asOf) },
    journalEntry: { is: postedJournalAt(asOf) },
  };
}
