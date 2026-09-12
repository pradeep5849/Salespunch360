import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("D final UI contracts", () => {
  it("keeps the Account top bar limited to company, notifications, and profile", () => {
    const shell = read("src/components/account/account-shell.tsx");
    expect(shell).toContain("companyName"); expect(shell).toContain("account notifications"); expect(shell).toContain("AccountProfileMenu");
    expect(shell).not.toContain("Company Consolidated"); expect(shell).not.toContain("selectAccountBranch"); expect(shell).not.toContain("switchWorkspace");
  });
  it("provides controlled profile dismissal and only the final menu content", () => {
    const profile = read("src/components/account/account-profile-menu.tsx");
    for (const behavior of ["pointerdown", "Escape", "popstate", "usePathname"]) expect(profile).toContain(behavior);
    for (const content of ["Profile &amp; password", "Sign out", "Account Admin", "Project Manager"]) expect(profile).toContain(content);
    expect(profile).not.toContain("branchContext");
  });
  it("exposes only supported direct Sales and Purchase workflows through filtered navigation", () => {
    const navigation = read("src/lib/account/navigation.ts");
    for (const type of ["SALES_INVOICE", "CUSTOMER_RECEIPT", "CREDIT_NOTE", "PROFORMA_INVOICE", "SALES_ORDER", "DELIVERY_CHALLAN", "PURCHASE_BILL", "VENDOR_PAYMENT", "DEBIT_NOTE", "PURCHASE_ORDER"]) expect(navigation).toContain(type);
    expect(navigation).toContain("canUsePermission"); expect(navigation).toContain("set.has(item.module)"); expect(navigation).not.toContain("Mobile POS");
  });
  it("keeps public authentication actions visible outside the collapsible navigation", () => {
    const header = read("src/components/public/public-header.tsx"), logo = read("src/components/brand-logo.tsx");
    expect(header.indexOf("mobile-auth-actions")).toBeLessThan(header.indexOf("<nav"));
    expect(header).toContain('href="/sign-in"'); expect(header).toContain('href="/register"');
    expect(logo).toContain("SalesPunch<span>360</span>"); expect(logo).not.toContain("salespunch360-logo.png");
  });
});
