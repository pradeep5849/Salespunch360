import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");

describe("monthly Sales targets regression",()=>{
 it("counts created leads instead of customer check-ins",()=>{
  const source=read("src/lib/targets/service.ts");
  expect(source).toContain('db.lead.groupBy({by:["assignedUserId"],where:{companyId:a.companyId,branchId:branches.branchId,assignedUserId:{in:userIds},createdAt:{gte:month.start,lt:month.endExclusive}}');
  expect(source).not.toContain("db.customerVisit.groupBy");
 });
 it("labels Web targets as Leads and Leads won with dynamic values and keeps Admin fields always editable",()=>{
  const page=read("src/app/workspace/targets/page.tsx");
  const row=read("src/app/workspace/targets/monthly-target-row.tsx");
  expect(page).toContain("Leads Target / Actual");
  expect(page).toContain("Leads Won Target / Actual");
  expect(page).not.toContain("Check-ins Target");
  expect(row).toContain("<small>Leads</small>");
  expect(row).toContain("<small>Leads won</small>");
  expect(row).toContain('canEdit?<input aria-label="Leads target"');
  expect(row).toContain('canEdit?<input aria-label="Leads won target"');
  expect(row).toContain('type="submit">Save</button>');
  expect(row).not.toContain("Edit</button>");
  expect(row).not.toContain("useState");
 });
 it("keeps Admin targets always editable with compact Type / Target rows on Android",()=>{
  const source=read("android/app/src/main/java/com/salespunch360/mobile/ui/TargetsScreen.kt");
  expect(source).toContain("val canEdit=role!=MobileRole.SALES");
  expect(source).toContain('Text("Type"');
  expect(source).toContain('Text("Target"');
  expect(source).toContain('TargetCompactField("Leads",leads,canEdit');
  expect(source).toContain('TargetCompactField("Leads won",won,canEdit');
  expect(source).toContain('Text(if(saving)"Saving…" else "Save Targets")');
  expect(source).not.toContain("Edit Targets");
  expect(source).not.toContain("var editing by remember");
  expect(source).not.toContain("Check-ins Target");
 });
});
