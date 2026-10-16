import { it, expect } from "vitest";
import { REPORT_CATALOGUE, searchReportCatalogue } from "./catalogue";
it("searches display names/groups while preserving Project Manager restrictions", () => {
  expect(
    searchReportCatalogue("ACCOUNT_ADMIN", "WITHDRAWAL").map((x) => x.key),
  ).toEqual(["profit-withdrawal"]);
  expect(searchReportCatalogue("PROJECT_MANAGER", "profit")).toEqual([]);
  expect(
    searchReportCatalogue("PROJECT_MANAGER", "project").map((x) => x.key),
  ).toEqual(["projects"]);
  expect(new Set(REPORT_CATALOGUE.map((x) => x.key)).size).toBe(
    REPORT_CATALOGUE.length,
  );
});
