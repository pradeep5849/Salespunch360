import { describe, it, expect } from "vitest";
import { journalMatchesInput } from "./journal-replay";
const value = () => ({
  financialYearId: "fy",
  branchId: "branch",
  entryDate: new Date("2026-10-09"),
  reference: null,
  narration: "same",
  lines: [
    { ledgerAccountId: "cash", debit: "10.00", credit: "0" },
    { ledgerAccountId: "income", debit: "0", credit: "10" },
  ],
});
describe("manual journal replay identity", () => {
  it("accepts normalized decimal equivalents and empty optional values", () => {
    const other = {
      ...value(),
      reference: "",
      lines: [
        { ledgerAccountId: "cash", debit: "10", credit: "0.00" },
        { ledgerAccountId: "income", debit: "0.0", credit: "10.00" },
      ],
    };
    expect(journalMatchesInput(value(), other)).toBe(true);
  });
  it.each(["branchId", "financialYearId", "narration"] as const)(
    "rejects changed %s",
    (key) => {
      expect(
        journalMatchesInput(value(), { ...value(), [key]: "different" }),
      ).toBe(false);
    },
  );
  it("rejects changed date amount and order", () => {
    expect(
      journalMatchesInput(value(), {
        ...value(),
        entryDate: new Date("2026-10-10"),
      }),
    ).toBe(false);
    expect(
      journalMatchesInput(value(), {
        ...value(),
        lines: [...value().lines].reverse(),
      }),
    ).toBe(false);
    expect(
      journalMatchesInput(value(), {
        ...value(),
        lines: [{ ...value().lines[0], debit: "11" }, value().lines[1]],
      }),
    ).toBe(false);
  });
});
