import { describe, expect, it } from "vitest";
import { expenseSummaryResult, expenseSummarySql } from "./expense-summary";
describe("A052 expense aggregate bounds and precision", () => {
  it("returns explicit all-history zero summary", () =>
    expect(expenseSummaryResult([])).toMatchObject({
      period: "ALL_POSTED_HISTORY",
      expense: "0.00",
      income: "0.00",
      categories: [],
    }));
  it("adds exact decimals and preserves signed reversal effects", () =>
    expect(
      expenseSummaryResult([
        {
          categoryId: "a",
          categoryName: "A",
          isActive: false,
          expense: "9007199254740991.01",
          income: "0.10",
        },
        {
          categoryId: "b",
          categoryName: "B",
          isActive: true,
          expense: "-0.02",
          income: "0.20",
        },
      ]),
    ).toMatchObject({ expense: "9007199254740990.99", income: "0.30" }));
  it("parameterizes malicious search and fails closed for empty assignments", () => {
    const query = expenseSummarySql(
      { companyId: "company", branchIds: [], projectIds: [] },
      { q: "%' OR TRUE --" },
    );
    expect(query.text).not.toContain("OR TRUE");
    expect(query.text.match(/FALSE/g)).toHaveLength(2);
    expect(query.values).toContain("%\\%' OR TRUE --%");
    expect(query.text).toContain('j."companyId" = e."companyId"');
  });
});
it("keeps recurring bill totals limited to the selected schedule", () => {
  const templateId = "11111111-1111-4111-8111-111111111111";
  const query = expenseSummarySql({ companyId: "company" }, { templateId });
  expect(query.text).toContain('e."occurrenceKey" LIKE');
  expect(query.values).toContain(templateId + ":%");
});
