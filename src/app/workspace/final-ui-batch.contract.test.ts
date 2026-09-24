import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const reportsHub=readFileSync('src/app/workspace/reports/page.tsx','utf8');
const dashboardPage=readFileSync('src/app/workspace/page.tsx','utf8');
const dashboardData=readFileSync('src/lib/workspace/dashboard.ts','utf8');
const attendancePage=readFileSync('src/app/workspace/attendance/page.tsx','utf8');
const billingHub=readFileSync('src/app/workspace/billing/page.tsx','utf8');
const subscriptionPage=readFileSync('src/app/workspace/billing/subscription/page.tsx','utf8');
const billingActions=readFileSync('src/app/workspace/billing/actions/page.tsx','utf8');
const salesTeamPage=readFileSync('src/app/workspace/billing/add-sales-team/page.tsx','utf8');
const accountTeamPage=readFileSync('src/app/workspace/billing/add-account-team/page.tsx','utf8');
const renewalPage=readFileSync('src/app/workspace/billing/renewal/page.tsx','utf8');
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

 it('uses a two-button Billing & Subscription hub with separate pages',()=>{
  expect(billingHub).toContain('href="/workspace/billing/subscription"');
  expect(billingHub).toContain('>Subscription</Link>');
  expect(billingHub).toContain('href="/workspace/billing/actions"');
  expect(billingHub).toContain('>Billing</Link>');
  expect(billingHub).not.toContain('title="Add Sales Team"');
  expect(billingHub).not.toContain('Sales Subscription</h2>');
  expect(subscriptionPage).toContain('Sales Subscription');
  expect(subscriptionPage).toContain('Account Subscription');
  expect(billingActions).toContain('>Add Sales Team</Link>');
  expect(billingActions).toContain('>Add Account Team</Link>');
  expect(billingActions).toContain('>Renewal</Link>');
  expect(billingActions).toContain('href="/workspace/billing/add-sales-team"');
  expect(billingActions).toContain('href="/workspace/billing/add-account-team"');
  expect(billingActions).toContain('href="/workspace/billing/renewal"');
  expect(salesTeamPage).toContain('backHref="/workspace/billing/actions"');
  expect(accountTeamPage).toContain('backHref="/workspace/billing/actions"');
  expect(renewalPage).toContain('backHref="/workspace/billing/actions"');
  expect(legacyAccountRoute).toContain("redirect('/workspace/billing/add-account-team')");
 });

 it('matches the two-step Billing and Subscription flow on Android',()=>{
  expect(androidSubscription).toContain('Text("Billing & Subscription")');
  expect(androidSubscription).toContain('page="SUBSCRIPTION"');
  expect(androidSubscription).toContain('page="BILLING"');
  expect(androidSubscription).toContain('SubscriptionSummaryPage(data)');
  expect(androidSubscription).toContain('BillingActionsPage');
  expect(androidSubscription).toContain('Text("Add Sales Team")');
  expect(androidSubscription).toContain('Text("Add Account Team")');
  expect(androidSubscription).toContain('Text("Renewal")');
  expect(androidSubscription).toContain('page="BILLING"');
 });
});
