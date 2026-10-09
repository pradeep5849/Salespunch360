import { describe, expect, it } from "vitest";
import { dashboardLinks, signedTrendPercent } from "./dashboard-links";
const branch = {
  mode: "BRANCH",
  branchId: "authorized",
  branchName: "Branch A",
} as const;
const from = new Date("2026-04-01"),
  to = new Date("2026-10-09");
describe("A048 dashboard destinations and truthful trends", () => {
  it.each(["ACCOUNT_ADMIN", "ACCOUNTANT"] as const)(
    "keeps distinct scoped destinations for %s",
    (role) => {
      const links = dashboardLinks(
        role,
        ["INVENTORY", "EXPENSES"],
        true,
        branch,
        from,
        to,
      );
      expect(links.items).toContain("inventory?branchId=authorized");
      expect(links.lowStock).toContain("inventory/low-stock?");
      expect(links.lowStock).toContain("asOf=2026-10-09");
      expect(links.expenseReport).toContain("from=2026-10-01");
      expect(links.reports).toContain("from=2026-04-01");
    },
  );
  it("hides destinations denied to Data Entry without changing permitted dashboard metrics", () =>
    expect(
      Object.values(
        dashboardLinks(
          "DATA_ENTRY",
          ["INVENTORY", "EXPENSES"],
          true,
          branch,
          from,
          to,
        ),
      ),
    ).toEqual([null, null, null, null, null]));
  it("does not expose stock destinations to Project Managers", () => {
    const x = dashboardLinks(
      "PROJECT_MANAGER",
      ["INVENTORY"],
      true,
      branch,
      from,
      to,
    );
    expect(x.items).toBeNull();
    expect(x.lowStock).toBeNull();
  });
  it.each([
    [[], true],
    [["INVENTORY"], false],
  ] as const)("honors both module and Items settings", (modules, on) => {
    const x = dashboardLinks("ACCOUNT_ADMIN", modules, on, branch, from, to);
    expect(x.items).toBeNull();
    expect(x.lowStock).toBeNull();
  });
  it("carries deliberate consolidated scope", () =>
    expect(
      dashboardLinks(
        "ACCOUNT_ADMIN",
        ["INVENTORY"],
        true,
        { mode: "COMPANY", branchId: null, branchName: null },
        from,
        to,
      ).reports,
    ).toContain("scope=all"));
  it("keeps zero empty and negative values negative with a common magnitude scale", () => {
    expect(signedTrendPercent("0", ["-100", "50", "0"])).toBe(0);
    expect(signedTrendPercent("-100", ["-100", "50", "0"])).toBe(-100);
    expect(signedTrendPercent("50", ["-100", "50", "0"])).toBe(50);
  });
});
