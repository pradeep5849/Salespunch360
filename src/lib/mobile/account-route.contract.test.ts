import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("native Account mobile API contract", () => {
  it("derives navigation and permissions on the server", () => {
    const source = readFileSync("src/lib/mobile/account.ts", "utf8");
    expect(source).toContain("buildAccountNavigation(actor");
    expect(source).toContain("rolePermissionSummary(actor.accountRole)");
    expect(source).toContain("resolveAccountBranchContext(actor");
  });
  it("keeps dashboard calculations in the shared server domain", () => {
    const source = readFileSync("src/lib/mobile/account.ts", "utf8");
    expect(source).toContain("accountBranchDashboard(actor");
    expect(source).not.toContain("prisma.$queryRaw");
  });
  it("does not route the Android Account workspace to its WebView", () => {
    const source = readFileSync("android/app/src/main/java/com/salespunch360/mobile/MainActivity.kt", "utf8");
    expect(source).toContain("Workspace.ACCOUNT->NativeAccountAuthenticatedApp");
    expect(source).not.toContain("Workspace.ACCOUNT->AccountWorkspaceScreen");
  });
  it("implements scoped native master-data endpoints", () => {
    const source = readFileSync("src/lib/mobile/account-master-data.ts", "utf8");
    expect(source).toContain("companyId: user.companyId");
    expect(source).toContain("branchFilter(user)");
    expect(source).toContain("assertOperationalWrite(user.companyId)");
    expect(source).toContain("partySchema");
    expect(source).toContain("itemSchema");
  });
});
