import { describe, expect, it } from "vitest";
import { reportExportRows } from "./export-data";

describe("A084 complete export contents", () => {
  it("retains rows, totals, notes and the applied scope without modifying source data", () => {
    const source={title:"Withdrawals",columns:["Date","Amount"],rows:[["2026-10-11","50"]],totals:["Net withdrawals","50"],note:"Drawings are not expenses."};
    const rows=reportExportRows(source,"from=2026-10-01&to=2026-10-11");
    expect(rows).toEqual([["2026-10-11","50"],["Net withdrawals","50"],["Drawings are not expenses.",""],["Scope: from=2026-10-01&to=2026-10-11",""]]);
    expect(source.rows).toHaveLength(1);
  });
});
