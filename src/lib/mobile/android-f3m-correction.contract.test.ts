import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const android=(path:string)=>readFileSync(new URL(`../../../android/app/src/main/java/com/salespunch360/mobile/${path}`,import.meta.url),"utf8");
const models=android("data/Models.kt"),api=android("data/ApiClient.kt"),employees=android("ui/EmployeesScreen.kt"),company=android("ui/CompanyManagementScreens.kt"),shell=android("ui/AppShell.kt");

describe("F3M Android correction source contract",()=>{
  it("invalidates both JSON and multipart authentication on 401 without clearing a newer token",()=>expect(api.match(/if\(it\.code==401\)session\.invalidateIfCurrent\(requestToken\)/g)).toHaveLength(2));
  it("models and presents independent Sales suspension",()=>{expect(models).toContain("salesAccessActive:Boolean");expect(models).toContain('"Sales access suspended"');expect(models).toContain('"Restore Sales access"');expect(models).toContain('"Reactivate identity"');expect(employees).toContain("isActiveEmployee(it)");expect(employees).toContain("selectableManagers(context.employees)")});
  it("shows all canonical seat dimensions",()=>{expect(shell).toContain("seatSummaryLines");expect(models).toContain("Primary Admin — Included / Free");expect(models).toContain("Additional Admin —");expect(models).toContain("adminSeats:Int=0");expect(models).toContain("adminLimit:Int=0");expect(models).toContain("adminUsage:Int=0")});
  it("keeps ADMIN pricing for every structure",()=>{expect(models).toContain('setOf("ADMIN","SALES")');expect(models).toContain('setOf("ADMIN","MANAGER","SALES")');expect(company).toContain("visiblePricingRoles(c.teamStructure)")});
});
