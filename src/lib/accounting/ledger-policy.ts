import type { JournalStatus } from "@prisma/client";
/** Original REVERSED entries and their POSTED reversals both remain ledger-effective. */
export const LEDGER_EFFECTIVE_JOURNAL_STATUSES = ["POSTED", "REVERSED"] as const satisfies readonly JournalStatus[];
export const isLedgerEffectiveStatus = (status: JournalStatus) => LEDGER_EFFECTIVE_JOURNAL_STATUSES.includes(status as typeof LEDGER_EFFECTIVE_JOURNAL_STATUSES[number]);
