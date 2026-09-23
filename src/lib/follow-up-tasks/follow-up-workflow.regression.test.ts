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
 it("keeps Due Today, Overdue and future Pending disjoint and scopes check-in to scheduled Visit follow-ups",()=>{
  const web=read("src/app/workspace/follow-up-tasks/page.tsx");
  const checkIns=read("src/app/workspace/check-ins/page.tsx");
  const visitWorkspace=read("src/app/workspace/check-ins/visit-workspace.tsx");
  const mobile=read("src/lib/mobile/follow-ups.ts");
  const androidField=read("android/app/src/main/java/com/salespunch360/mobile/ui/FieldScreen.kt");
  expect(web).toContain('listFollowUpTasks({...q,status:selected})');
  expect(web).toContain('selected==="PENDING"?rawTasks.filter(task=>task.dueDate>=tomorrow)');
  expect(checkIns).toContain('task.type==="VISIT"');
  expect(checkIns).toContain('bucket:"Overdue"');
  expect(checkIns).toContain('bucket:"Due Today"');
  expect(checkIns).toContain('bucket:"Upcoming"');
  expect(visitWorkspace).toContain("Scheduled visit follow-up");
  expect(visitWorkspace).toContain('name="followUpTaskId"');
  expect(androidField).toContain("Scheduled visit follow-up");
  expect(androidField).toContain("FollowUpSelector(state.followUps");
  expect(mobile).toContain("dueDate:{gte:tomorrow}");
  expect(mobile).toContain("canStartCheckIn:isVisit");
 });
 it("requires the assigned salesperson to save a Call outcome note",()=>{
  const web=read("src/app/workspace/follow-up-tasks/page.tsx");
  const completion=read("src/lib/follow-up-tasks/call-completion.ts");
  const mobile=read("src/lib/mobile/follow-ups.ts");
  const android=read("android/app/src/main/java/com/salespunch360/mobile/ui/FollowUpsScreen.kt");
  const mutation=read("android/app/src/main/java/com/salespunch360/mobile/data/FollowUpMutationClient.kt");
  expect(web).toContain('name="outcomeNote"');
  expect(web).toContain('isCall&&own&&t.status==="PENDING"');
  expect(completion).toContain("task.assignedUserId!==actor.id");
  expect(completion).toContain("Call outcome:");
  expect(mobile).toContain("task.assignedUserId===user.id");
  expect(android).toContain("Update Call Outcome");
  expect(android).toContain("Call outcome note");
  expect(mutation).toContain("outcomeNote");
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
