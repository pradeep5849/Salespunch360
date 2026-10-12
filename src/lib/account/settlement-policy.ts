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
