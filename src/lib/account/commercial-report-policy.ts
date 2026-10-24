import type { Prisma } from "@prisma/client";
import { postedJournalAt } from "./settlement-policy";

/** Lifecycle cancellation cannot erase a posted document's dated economic effect. */
export function economicDocumentsAt(asOf: Date): Prisma.CommercialDocumentWhereInput {
  return {
    status: { in: ["POSTED", "CANCELLED"] },
    journalEntry: { is: postedJournalAt(asOf) },
  };
}
