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
    expect(navigation).toContain("canUsePermission"); expect(navigation).toContain("item.requiredModules"); expect(navigation).not.toContain("Mobile POS");
  });
  it("keeps public authentication actions visible outside the collapsible navigation", () => {
    const header = read("src/components/public/public-header.tsx"), logo = read("src/components/brand-logo.tsx");
    expect(header.indexOf("mobile-auth-actions")).toBeLessThan(header.indexOf("<nav"));
    expect(header).toContain('href="/sign-in"'); expect(header).toContain('href="/register"');
    expect(logo).toContain("/salespunch360-logo.png"); expect(logo).not.toContain("brand-mark");
  });
  it("uses one section slug helper in desktop Account navigation and Menu", () => {
    expect(read("src/components/account/account-shell.tsx")).toContain("accountNavSectionId(group.label)");
    expect(read("src/app/workspace/account/menu/page.tsx")).toContain("accountNavSectionId(group.label)");
  });
  it("keeps authorized Sales workspace switching available on desktop and mobile", () => {
    const header = read("src/components/workspace/workspace-header.tsx"), css = read("src/app/globals.css");
    expect(header).toContain('canSwitchWorkspace&&<details className="workspace-desktop-workspace-menu"');
    expect(header).toContain('canSwitchWorkspace&&<form action={switchWorkspace} onSubmit={closeDrawer}');
    expect((header.match(/Switch to Accounts/g) ?? [])).toHaveLength(2);
    expect(css).toContain("@media(max-width:760px){.workspace-desktop-workspace-menu{display:none}}");
  });
});
