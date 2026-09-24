import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const reportsHub=readFileSync('src/app/workspace/reports/page.tsx','utf8');
const dashboardPage=readFileSync('src/app/workspace/page.tsx','utf8');
const dashboardData=readFileSync('src/lib/workspace/dashboard.ts','utf8');
const attendancePage=readFileSync('src/app/workspace/attendance/page.tsx','utf8');
const billingPage=readFileSync('src/app/workspace/billing/page.tsx','utf8');
const accountTeamPage=readFileSync('src/app/workspace/billing/add-account-team/page.tsx','utf8');
const legacyAccountRoute=readFileSync('src/app/workspace/billing/add-account-package/page.tsx','utf8');
const androidSubscription=readFileSync('android/app/src/main/java/com/salespunch360/mobile/ui/SubscriptionScreen.kt','utf8');
const androidAttendance=readFileSync('android/app/src/main/java/com/salespunch360/mobile/ui/TeamAttendanceScreen.kt','utf8');

describe('final UI and subscription batch',()=>{
 it('opens only the selected report instead of a report-directory list',()=>{
  expect(reportsHub).toContain('redirect("/workspace/reports/check-ins")');
  expect(reportsHub).not.toContain('report-hub');
 });

 it('limits Admin Check-in Activity to check-in-authorized field staff',()=>{
  expect(dashboardData).toContain('checkInEmployees=employees.filter');
  expect(dashboardData).toContain('employee.managerType!=="MANAGER_ONLY"');
  expect(dashboardData).toContain('!isTelecallerDesignation(employee.designation)');
  expect(dashboardPage).toContain('d.checkInEmployees.map');
 });

 it('shows team attendance in India time on Web and Android',()=>{
  expect(attendancePage).toContain('timeZone:"Asia/Kolkata"');
  expect(attendancePage).toContain('} IST`');
  expect(attendancePage).not.toContain('timeZone:"UTC"');
  expect(androidAttendance).toContain('ZoneId.of("Asia/Kolkata")');
  expect(androidAttendance).toContain('+" IST"');
 });

 it('uses exactly three top-level subscription actions and dedicated pages',()=>{
  expect(billingPage).toContain('title="Add Sales Team"');
  expect(billingPage).toContain('title="Add Account Team"');
  expect(billingPage).toContain('title="Renewal"');
  expect(billingPage).toContain('href="/workspace/billing/add-sales-team"');
  expect(billingPage).toContain('href="/workspace/billing/add-account-team"');
  expect(billingPage).toContain('href="/workspace/billing/renewal"');
  expect(billingPage).not.toContain('<details');
  expect(accountTeamPage).toContain('title="Add Account Team"');
  expect(legacyAccountRoute).toContain("redirect('/workspace/billing/add-account-team')");
 });

 it('replaces the Android subscription screen with the selected action instead of expanding underneath',()=>{
  expect(androidSubscription).toContain('Text("Add Sales Team")');
  expect(androidSubscription).toContain('Text("Add Account Team")');
  expect(androidSubscription).toContain('Text("Renewal")');
  expect(androidSubscription).toContain('if(page!=null){SubscriptionActionPage');
  expect(androidSubscription).toContain(';return}');
  expect(androidSubscription).toContain('"ADD_ACCOUNT"->"Add Account Team"');
 });
});
