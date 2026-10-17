import { it, expect } from "vitest";
import { REPORT_CATALOGUE, reportSpecificFilters,searchReportCatalogue } from "./catalogue";
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

it("exposes only filter dimensions consumed by each supported report", () => {
  expect(reportSpecificFilters("profit-loss")).toEqual([]);
  expect(reportSpecificFilters("general-ledger")).toEqual(["ledgerId"]);
  expect(reportSpecificFilters("profit-withdrawal")).toEqual(["ownerId"]);
  expect(reportSpecificFilters("items")).toEqual([
    "projectId",
    "customerId",
    "productId",
  ]);
});

it("maps Purchase Register to its own vendor-filtered destination",()=>{expect(searchReportCatalogue("ACCOUNT_ADMIN","purchase register")).toEqual([{key:"purchase-register",name:"Purchase Register",group:"Transaction"}]);expect(reportSpecificFilters("purchase-register")).toEqual(["vendorId"]);expect(searchReportCatalogue("PROJECT_MANAGER","purchase register")).toEqual([])});

it("maps implemented Project movement reports with only consumed filters",()=>{for(const key of ["material-consumption","project-transfer"]){expect(REPORT_CATALOGUE.some(x=>x.key===key)).toBe(true);expect(reportSpecificFilters(key)).toEqual(["projectId","productId"]);expect(searchReportCatalogue("PROJECT_MANAGER",key)).toEqual([])}});
