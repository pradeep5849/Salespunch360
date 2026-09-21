import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (p: string) => fs.readFileSync(p, "utf8");
describe("native expense and inventory boundaries", () => {
  it("keeps expense lifecycle in shared server domain", () => {
    const mobile = read("src/lib/mobile/account-expenses.ts"),
      domain = read("src/lib/account/expenses.ts");
    for (const operation of [
      "createExpenseForActor",
      "transitionExpenseForActor",
      "postExpenseForActor",
      "reverseExpenseForActor",
      "addExpenseAttachmentForActor",
    ])
      expect(mobile).toContain(operation);
    expect(domain).toContain("calculateTax");
    expect(domain).toContain("postJournalInTx");
  });
  it("keeps stock validation and valuation on the server", () => {
    const mobile = read("src/lib/mobile/account-inventory.ts"),
      domain = read("src/lib/account/inventory.ts");
    expect(mobile).toContain("createStockMovementForActor");
    expect(mobile).toContain("transferStockForActor");
    expect(domain).toContain("INSUFFICIENT_STOCK");
    expect(domain).toContain("stockValuation");
  });
  it("routes native Compose screens without a web fallback", () => {
    const shell = read(
      "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt",
    );
    expect(shell).toContain("ExpenseScreen(padding)");
    expect(shell).toContain("InventoryScreen(");
    expect(shell).not.toContain("AccountWorkspaceScreen");
  });
});
