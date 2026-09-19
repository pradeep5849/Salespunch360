import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";const page=readFileSync("src/app/workspace/employees/page.tsx","utf8"),policy=readFileSync("src/app/workspace/employees/directory-policy.ts","utf8"),managerForm=readFileSync("src/app/workspace/employees/sales/new/[kind]/page.tsx","utf8");
describe("F3KL user-management presentation",()=>{
 it("keeps Sales and Account employee domains",()=>{expect(page).toContain("Sales Employees");expect(page).toContain("Account Employees")});
 it("excludes Primary Admin centrally",()=>expect(policy).toContain('user.salesRole!=="PRIMARY_ADMIN"'));
 it("treats suspended access as inactive",()=>{expect(policy).toContain('x.isActive&&x.salesAccessActive');expect(policy).toContain('!x.isActive||!x.salesAccessActive')});
 it("gates mutation links to management authority",()=>expect(page).toContain('canManage=context.actor.salesRole==="PRIMARY_ADMIN"'));
 it("uses dedicated add and edit routes",()=>{expect(page).toContain('/workspace/employees/sales/new/');expect(page).toContain('/workspace/employees/${domain}/edit/')});
 it("shows one Managers section and selects manager type while adding",()=>{expect(page).toContain('group("Managers",managers,"MANAGER"');expect(page).not.toContain('<EmployeeGroup title="Office Managers"');expect(managerForm).toContain('select name="managerType"');expect(managerForm).toContain('<option value="FIELD_MANAGER">Field Manager</option>');expect(managerForm).toContain('<option value="MANAGER_ONLY">Office Manager</option>')});
});
