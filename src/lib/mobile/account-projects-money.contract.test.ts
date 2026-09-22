import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (p: string) => fs.readFileSync(p, "utf8");
describe("native project, category and money boundaries", () => {
  it("uses server-authoritative project and costing domains", () => {
    const s = read("src/lib/mobile/account-projects.ts");
    for (const x of [
      "listProjectsForActor",
      "createProjectForActor",
      "updateProjectForActor",
      "getProjectForActor",
      "loadProjectCostingForActor",
      "assertOperationalWrite",
      "requireAccountModules",
    ])
      expect(s).toContain(x);
  });
  it("keeps money posting and balances in the shared server domain", () => {
    const s = read("src/lib/mobile/account-money.ts"),
      d = read("src/lib/account/money.ts");
    for (const x of [
      "createMoneyTransferForActor",
      "postOwnerTransactionForActor",
      "createAndReceiveLoanForActor",
      "postLoanPaymentForActor",
    ])
      expect(s).toContain(x);
    expect(d).toContain("postJournalInTx");
    expect(d).toContain("ledgerBalance");
  });
  it("routes real Compose destinations without web fallback", () => {
    const s = read(
      "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt",
    );
    for (const x of [
      "ExpenseCategoryScreen(padding)",
      "ProjectScreen(padding)",
      "MoneyScreen(",
      "AccountingScreen(",
    ])
      expect(s).toContain(x);
    expect(s).not.toContain("AccountWorkspaceScreen");
  });
  it("exposes category writes only through authoritative category service", () => {
    const s = read("src/lib/mobile/account-expenses.ts");
    expect(s).toContain("saveExpenseCategoryForActor");
    expect(s).toContain("deactivateExpenseCategoryForActor");
    expect(s).toContain("assertOperationalWrite");
  });
});
