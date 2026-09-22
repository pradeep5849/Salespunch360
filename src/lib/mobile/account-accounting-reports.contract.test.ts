import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (p: string) => fs.readFileSync(p, "utf8");
describe("native accounting and reports boundaries", () => {
  it("delegates journal posting and reversal to authoritative accounting", () => {
    const s = read("src/lib/mobile/account-accounting.ts");
    for (const x of [
      "postJournalForActor",
      "postOpeningBalancesForActor",
      "reverseJournalForActor",
      "setPeriodLockForActor",
      "assertOperationalWrite",
    ])
      expect(s).toContain(x);
  });
  it("delegates asset and financial-year lifecycle", () => {
    const s = read("src/lib/mobile/account-accounting.ts");
    for (const x of [
      "createAssetForActor",
      "updateAssetForActor",
      "assignAssetForActor",
      "returnAssetForActor",
      "setAssetStatusForActor",
      "createFinancialYearForActor",
      "closeFinancialYearForActor",
    ])
      expect(s).toContain(x);
  });
  it("exposes every current web financial report and native exports", () => {
    const s = read("src/lib/mobile/account-reports.ts"),
      ui = read(
        "android/app/src/main/java/com/salespunch360/mobile/ui/account/reports/AccountReportsScreen.kt",
      );
    for (const r of [
      "profit-loss",
      "balance-sheet",
      "trial-balance",
      "cash-flow",
      "general-ledger",
      "customer-ledger",
      "vendor-ledger",
      "receivable-aging",
      "payable-aging",
      "cash-bank",
      "owner-capital",
      "projects",
      "branches",
      "items",
      "invoices",
      "customers",
      "tax",
      "budget-vs-actual",
    ])
      expect(s).toContain(r);
    for (const f of ["csv", "xlsx", "pdf"]) expect(ui).toContain(f);
  });
  it("routes accounting and reports only to Compose", () => {
    const s = read(
      "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt",
    );
    for (const x of [
      "ChartOfAccountsScreen",
      "JournalScreen",
      "AssetScreen",
      "FinancialYearScreen",
      "AccountReportsScreen",
    ])
      expect(s).toContain(x);
    expect(s).not.toContain("AccountWorkspaceScreen");
  });
});
