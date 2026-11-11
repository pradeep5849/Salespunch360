import { describe, it, expect } from "vitest";
import { buildAccountNavigation, hasAccountNavigationItem } from "./navigation";
const actor = {
  id: "reader",
  companyId: "company",
  role: "COMPANY_ADMIN",
  isActive: true,
  managerType: null,
  salesRole: null,
  accountAccessActive: true,
  salesAccessActive: false,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
  accountRole: "ACCOUNT_ADMIN",
} as const;
const navigation = (
  role = actor.accountRole as string,
  modules = ["INVENTORY"] as string[],
) =>
  buildAccountNavigation(
    { ...actor, accountRole: role } as never,
    "SALESPUNCH360_ACCOUNT",
    modules as never,
  );
describe("selected Utilities reference menu", () => {
  it("contains the selected Utilities options plus owner-requested Period Locks", () => {
    const group = navigation().find((x) => x.label === "Utilities")!;
    expect(group.expandable).toBe(true);
    expect(group.items.map((x) => x.label)).toEqual([
      "Verify my data",
      "Import Items",
      "Export Items",
      "Import Parties",
      "Recycle Bin",
      "Close Financial Year",
      "Period Locks",
    ]);
    expect(
      group.items.some((x) =>
        /Calculator|BillBook|Import, export|Bulk Update Tax Slab|Messages/.test(
          x.label,
        ),
      ),
    ).toBe(false);
  });
  it("preselects item import/export and preserves party import choice", () => {
    const group = navigation().find((x) => x.label === "Utilities")!;
    expect(group.items.find((x) => x.label === "Import Items")?.href).toBe(
      "/workspace/account/utilities/import?type=ITEMS",
    );
    expect(group.items.find((x) => x.label === "Export Items")?.href).toBe(
      "/workspace/account/utilities/export?type=items",
    );
    expect(group.items.find((x) => x.label === "Import Parties")?.href).toBe(
      "/workspace/account/utilities/import?type=CUSTOMERS",
    );
  });
  it("never presents unimplemented actions as enabled capabilities", () => {
    const nav = navigation();
    const pending = nav
      .find((x) => x.label === "Utilities")!
      .items.filter((x) => x.disabled);
    expect(pending.map((x) => x.label)).toEqual([]);
    for (const item of pending)
      expect(hasAccountNavigationItem(nav, item.label, item.href)).toBe(false);
  });
  it("hides item tools when Inventory is disabled", () => {
    expect(
      navigation("ACCOUNT_ADMIN", [])
        .find((x) => x.label === "Utilities")!
        .items.some((x) => ["Import Items", "Export Items"].includes(x.label)),
    ).toBe(false);
  });
  it("does not expose administrator-only actions or backup to Data Entry", () => {
    const nav = navigation("DATA_ENTRY");
    expect(nav.find((x) => x.label === "Backup/Restore")).toBeUndefined();
    expect(
      nav
        .find((x) => x.label === "Utilities")
        ?.items.some((x) =>
          [
            "Recycle Bin",
            "Close Financial Year",
            "Messages",
            "Bulk Update Tax Slab",
          ].includes(x.label),
        ) ?? false,
    ).toBe(false);
  });
  it("preserves Backup outside the selected Utilities options", () => {
    const nav = navigation();
    expect(
      nav.find((x) => x.label === "Backup/Restore")?.items.map((x) => x.label),
    ).toEqual([
      "Auto Backup",
      "Backup to phone",
      "Backup to e-mail",
      "Restore backup",
    ]);
    expect(
      nav
        .find((x) => x.label === "Utilities")!
        .items.some((x) => x.href.includes("/backup")),
    ).toBe(false);
  });
});

it("hides item tools when company item features are switched off", () => {
  const nav = buildAccountNavigation(
    actor as never,
    "SALESPUNCH360_ACCOUNT",
    ["INVENTORY"],
    false,
  );
  expect(
    nav
      .find((x) => x.label === "Utilities")!
      .items.some((x) => ["Import Items", "Export Items"].includes(x.label)),
  ).toBe(false);
});

it("exposes Period Locks once in Utilities only to authorized roles", () => {
  const nav = navigation();
  expect(
    nav
      .find((g) => g.label === "Utilities")
      ?.items.find((i) => i.label === "Period Locks")?.href,
  ).toBe("/workspace/account/utilities/period-locks");
  expect(
    nav
      .flatMap((g) => g.items)
      .filter((i) => i.href === "/workspace/account/utilities/period-locks"),
  ).toHaveLength(1);
  for (const role of ["DATA_ENTRY", "ACCOUNTANT", "PROJECT_MANAGER"])
    expect(
      navigation(role)
        .flatMap((g) => g.items)
        .some((i) => i.href === "/workspace/account/utilities/period-locks"),
    ).toBe(false);
});
