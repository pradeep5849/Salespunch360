import{describe,expect,it}from"vitest";import{readFileSync}from"node:fs";
const page=readFileSync(new URL("./page.tsx",import.meta.url),"utf8"),workspace=readFileSync(new URL("./visit-workspace.tsx",import.meta.url),"utf8"),dashboard=readFileSync(new URL("../page.tsx",import.meta.url),"utf8");
describe("check-in UI structure",()=>{
 it("places the personal Add Check-in action after recent content",()=>{expect(dashboard.indexOf('recent-checkins-slider')).toBeLessThan(dashboard.indexOf('dashboard-checkin-action'));expect(dashboard.indexOf('dash-empty')).toBeLessThan(dashboard.indexOf('dashboard-checkin-action'));});
 it("uses the shared header without a duplicate SP badge",()=>{expect(page).not.toContain('<span>SP</span>');expect(page).not.toContain('SalesPunch360</div>');expect(page).toContain('<h1>Check-ins</h1>');});
 it("retains all three selectors",()=>{for(const label of ["New","Follow-up","Customer"])expect(workspace).toContain(`'${label}'`);expect(workspace).toContain('aria-pressed={type===value}');});
 it("keeps Pending Checkout separate and below the check-in form",()=>{expect(workspace.indexOf('</form><section className="pending-visits"')).toBeGreaterThan(0);expect(workspace).toContain('Pending Checkout');});
});
