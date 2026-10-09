"use server";
import { accountAction } from "@/lib/account/action-feedback";
import { revalidatePath } from "next/cache";
import {
  createCostCentre,
  createLedgerAccount,
  postJournal,
  postOpeningBalances,
  reverseJournal,
  setPeriodLock,
} from "@/lib/accounting/service";
import { registerPartyOpeningBalance } from "@/lib/account/opening-balances";
export async function accountingAction(fd: FormData) {
  return accountAction(async () => {
    const operation = String(fd.get("operation")),
      raw = Object.fromEntries(fd.entries());
    if (operation === "account") await createLedgerAccount(raw);
    else if (operation === "cost-centre") await createCostCentre(raw);
    else if (operation === "period-lock")
      await setPeriodLock({ ...raw, lockedThrough: raw.lockedThrough || null });
    else if (operation === "register-party-opening")
      await registerPartyOpeningBalance({
        branchId: raw.branchId,
        partyType: raw.partyType,
        partyId: raw.partyId,
        journalEntryId: raw.journalEntryId,
      });
    else if (operation === "reverse") await reverseJournal(raw);
    else if (operation === "journal" || operation === "opening") {
      const accountIds = fd.getAll("ledgerAccountId").map(String),
        debits = fd.getAll("debit").map(String),
        credits = fd.getAll("credit").map(String);
      const costs = fd.getAll("costCentreId").map(String),
        descriptions = fd.getAll("description").map(String);
      const input = {
        ...raw,
        sourceType:
          operation === "opening" ? "OPENING_BALANCE" : "MANUAL_JOURNAL",
        sourceId: String(raw.sourceId),
        postingPurpose: "PRIMARY",
        lines: accountIds.map((ledgerAccountId, i) => ({
          ledgerAccountId,
          debit: debits[i] || "0",
          credit: credits[i] || "0",
          costCentreId: costs[i] || undefined,
          description: descriptions[i] || undefined,
        })),
      };
      const saved =
        operation === "opening"
          ? await postOpeningBalances(input)
          : await postJournal(input);
      revalidatePath("/workspace/account/accounting");
      return `/workspace/account/accounting/journals?q=${encodeURIComponent(saved.journalNumber)}`;
    } else throw new Error("INVALID_OPERATION");
    revalidatePath("/workspace/account/accounting");
  }, "Accounting change saved successfully");
}
