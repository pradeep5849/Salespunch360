import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";const page=readFileSync("src/app/workspace/employees/page.tsx","utf8"),policy=readFileSync("src/app/workspace/employees/directory-policy.ts","utf8"),managerForm=readFileSync("src/app/workspace/employees/sales/new/[kind]/manager-create-form.tsx","utf8"),actions=readFileSync("src/app/actions/employees.ts","utf8");
describe("F3KL user-management presentation",()=>{
 it("keeps Sales and Account employee domains",()=>{expect(page).toContain("Sales Employees");expect(page).toContain("Account Employees")});
 it("excludes Primary Admin centrally",()=>expect(policy).toContain('user.salesRole!=="PRIMARY_ADMIN"'));
 it("treats suspended access as inactive",()=>{expect(policy).toContain('x.isActive&&x.salesAccessActive');expect(policy).toContain('!x.isActive||!x.salesAccessActive')});
 it("gates mutation links to management authority",()=>expect(page).toContain('canManage=context.actor.salesRole==="PRIMARY_ADMIN"'));
 it("uses dedicated add and edit routes",()=>{expect(page).toContain('/workspace/employees/sales/new/');expect(page).toContain('/workspace/employees/${domain}/edit/')});
 it("shows one Manager section and no separate Office Managers section",()=>{expect(page).toContain('group("Manager",managers,"MANAGER"');expect(page).not.toContain('<EmployeeGroup title="Office Managers"')});
 it("keeps manager creation in the web form and exposes action errors",()=>{expect(managerForm).toContain('useActionState(manageEmployee');expect(managerForm).toContain('name="operation" value="create-manager"');expect(managerForm).toContain('value="FIELD_MANAGER">Field Manager');expect(managerForm).toContain('value="MANAGER_ONLY">Office Manager');expect(actions).toContain('COMPANY_PROFILE_REQUIRED');expect(actions).toContain('EMAIL_IN_USE')});
});
