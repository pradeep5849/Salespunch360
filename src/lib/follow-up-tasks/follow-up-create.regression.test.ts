import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");

describe("follow-up creation regression",()=>{
 it("offers Visit and Call on Web",()=>{
  const source=read("src/app/workspace/leads/follow-up-form.tsx");
  expect(source).toContain('<option value="VISIT">Visit</option>');
  expect(source).toContain('<option value="CALL">Call</option>');
  expect(source).toContain('type:form.get("type")');
 });
 it("offers Visit and Call on Android",()=>{
  const source=read("android/app/src/main/java/com/salespunch360/mobile/ui/LeadsScreen.kt");
  expect(source).toContain('Text("Follow-up type"');
  expect(source).toContain('Text("Visit")');
  expect(source).toContain('Text("Call")');
  expect(source).toContain('SP360_CLIENT_TYPE:CALL');
 });
 it("keeps call tasks out of the visit check-in action",()=>{
  const source=read("src/lib/mobile/follow-ups.ts");
  expect(source).toContain("isVisit&&mobileFieldWorkEnabled");
  expect(source).toContain("presentation.type==='CALL'?'Call pending'");
 });
});
