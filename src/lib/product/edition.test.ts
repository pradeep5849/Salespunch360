import { ProductEdition } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hasAccountsWorkspace, hasSalesWorkspace } from "./edition";

describe("product edition foundation", () => {
  it.each([
    [ProductEdition.SALESPUNCH360, true, false],
    [ProductEdition.SALESPUNCH360_ACCOUNT, false, true],
    [ProductEdition.SALESPUNCH360_PLUS, true, true],
  ])("has the expected workspace matrix for %s", (edition, sales, accounts) => {
    expect(hasSalesWorkspace(edition)).toBe(sales);
    expect(hasAccountsWorkspace(edition)).toBe(accounts);
  });
});
