import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const reportsHub=readFileSync("src/app/workspace/reports/page.tsx","utf8");
const dashboardPage=readFileSync("src/app/workspace/page.tsx","utf8");
const dashboardData=readFileSync("src/lib/workspace/dashboard.ts","utf8");
const mobileDashboard=readFileSync("src/app/api/v1/mobile/dashboard/route.ts","utf8");
const attendance=readFileSync("src/app/workspace/attendance/page.tsx","utf8");
const androidAttendance=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/TeamAttendanceScreen.kt","utf8");
const androidReports=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/ReportsScreen.kt","utf8");

describe("final UI correction contract",()=>{
 it("does not render the full Web report catalog when opening Reports",()=>{
  expect(reportsHub).toContain('redirect("/workspace/reports/check-ins")');
  expect(reportsHub).not.toContain("Check-in Report','Visits");
 });
 it("limits Check-in Activity selection to field/check-in employees",()=>{
  expect(dashboardPage).toContain("d.checkInEmployees.map");
  expect(dashboardData).toContain('employee.managerType!=="MANAGER_ONLY"');
  expect(dashboardData).toContain("!isTelecallerDesignation(employee.designation)");
  expect(mobileDashboard).toContain("checkInEmployees");
  expect(mobileDashboard).toContain("!isTelecallerDesignation(employee.designation)");
 });
 it("renders attendance time in India Standard Time on Web and Android",()=>{
  expect(attendance).toContain('timeZone:"Asia/Kolkata"');
  expect(attendance).toContain('} IST`');
  expect(attendance).not.toContain('timeZone: "UTC"');
  expect(androidAttendance).toContain('ZoneId.of("Asia/Kolkata")');
  expect(androidAttendance).toContain('+" IST"');
 });
 it("keeps the Android report list collapsed after a report is selected",()=>{
  expect(androidReports).toContain("mutableStateOf(false)");
  expect(androidReports).toContain("expanded=false;vm.load(id)");
 });
});
