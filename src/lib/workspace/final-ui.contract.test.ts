import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const reportsHub=readFileSync("src/app/workspace/reports/page.tsx","utf8");
const dashboardPage=readFileSync("src/app/workspace/page.tsx","utf8");
const dashboardData=readFileSync("src/lib/workspace/dashboard.ts","utf8");
const mobileDashboard=readFileSync("src/app/api/v1/mobile/dashboard/route.ts","utf8");
const attendance=readFileSync("src/app/workspace/attendance/page.tsx","utf8");
const androidAttendance=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/TeamAttendanceScreen.kt","utf8");
const androidReports=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/ReportsScreen.kt","utf8");
const billingHub=readFileSync("src/app/workspace/billing/page.tsx","utf8");
const subscriptionPage=readFileSync("src/app/workspace/billing/subscription/page.tsx","utf8");
const billingActions=readFileSync("src/app/workspace/billing/actions/page.tsx","utf8");
const accountTeam=readFileSync("src/app/workspace/billing/add-account-team/page.tsx","utf8");
const androidBilling=readFileSync("android/app/src/main/java/com/salespunch360/mobile/ui/SubscriptionScreen.kt","utf8");

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
 it("opens Android reports on a dedicated page instead of expanding below the menu",()=>{
  expect(androidReports).toContain('var selected by remember');
  expect(androidReports).toContain('Text("← Reports")');
  expect(androidReports).toContain('if(showMenu&&selected==null)');
  expect(androidReports).not.toContain('expanded=false;vm.load(id)');
 });
 it("uses a two-button Billing & Subscription hub with dedicated Subscription and Billing pages",()=>{
  expect(billingHub).toContain('/workspace/billing/subscription');
  expect(billingHub).toContain('>Subscription</Link>');
  expect(billingHub).toContain('/workspace/billing/actions');
  expect(billingHub).toContain('>Billing</Link>');
  expect(billingHub).not.toContain('title="Add Sales Team"');
  expect(subscriptionPage).toContain('Sales Subscription');
  expect(subscriptionPage).toContain('Account Subscription');
  expect(billingActions).toContain('>Add Sales Team</Link>');
  expect(billingActions).toContain('/workspace/billing/add-sales-team');
  expect(billingActions).toContain('>Add Account Team</Link>');
  expect(billingActions).toContain('/workspace/billing/add-account-team');
  expect(billingActions).toContain('>Renewal</Link>');
  expect(billingActions).toContain('/workspace/billing/renewal');
  expect(accountTeam).toContain('title="Add Account Team"');
  expect(androidBilling).toContain('Text("Billing & Subscription",');
  expect(androidBilling).toContain('page="SUBSCRIPTION"');
  expect(androidBilling).toContain('page="BILLING"');
  expect(androidBilling).toContain('SubscriptionSummaryPage(data)');
  expect(androidBilling).toContain('BillingActionsPage');
  expect(androidBilling).toContain('Text("Add Sales Team")');
  expect(androidBilling).toContain('Text("Add Account Team")');
  expect(androidBilling).toContain('Text("Renewal")');
 });
});
