import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(path,"utf8");

describe("Sales follow-up workflow regressions",()=>{
 it("confirms a saved follow-up and shows it on the lead",()=>{
  const form=read("src/app/workspace/leads/follow-up-form.tsx");
  const detail=read("src/app/workspace/leads/[id]/page.tsx");
  expect(form).toContain("follow-up added successfully");
  expect(form).toContain("listed under");
  expect(detail).toContain("listLeadFollowUpTasks");
  expect(detail).toContain("<h2>Follow-ups</h2>");
 });
 it("partitions follow-ups and keeps Call separate from Visit check-in",()=>{
  const web=read("src/app/workspace/follow-up-tasks/page.tsx");
  const mobile=read("src/lib/mobile/follow-ups.ts");
  expect(web).toContain('selected==="PENDING"?rawTasks.filter(task=>task.dueDate>=tomorrow)');
  expect(web).toContain("Mark Call Completed");
  expect(web).toContain('!isCall&&own&&t.status==="PENDING"');
  expect(mobile).toContain("dueDate:{gte:tomorrow}");
  expect(mobile).toContain("Call completed");
 });
 it("automatically hands won Plus leads to Projects and reconciles old won leads",()=>{
  const handover=read("src/lib/leads/won-project.ts");
  const action=read("src/app/actions/leads.ts");
  const detail=read("src/app/workspace/leads/[id]/page.tsx");
  expect(handover).toContain('productEdition!=="SALESPUNCH360_PLUS"');
  expect(handover).toContain('enabledModules.includes("PROJECTS")');
  expect(handover).toContain("sourceLeadId:lead.id");
  expect(action).toContain('toStage==="WON"');
  expect(detail).toContain('lead.stage==="WON"');
 });
 it("keeps saved targets locked until Edit is clicked on Web and Android",()=>{
  const web=read("src/app/workspace/targets/monthly-target-row.tsx");
  const android=read("android/app/src/main/java/com/salespunch360/mobile/ui/TargetsScreen.kt");
  expect(web).toContain("useState(false)");
  expect(web).toContain('>Edit</button>');
  expect(web).toContain('setEditing(false)');
  expect(android).toContain('OutlinedButton({editing=true}');
  expect(android).toContain('Text(if(saving)"Saving…" else "Save")');
  expect(android).toContain('{editing=false}');
 });
});
