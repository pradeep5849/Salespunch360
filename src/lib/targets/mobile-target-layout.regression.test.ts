import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";

const read=(path:string)=>readFileSync(path,"utf8");

describe("mobile Sales target layout",()=>{
 it("shows Type/Target and stacks Leads above Leads won on mobile Web",()=>{
  const row=read("src/app/workspace/targets/monthly-target-row.tsx");
  const css=read("src/app/workspace/targets/monthly-target-row.module.css");
  expect(row).toContain("<span>Type</span><span>Target</span>");
  expect(row.indexOf("<small>Leads</small>")).toBeLessThan(row.indexOf("<small>Leads won</small>"));
  expect(css).toContain(".row.row{grid-template-columns:1fr");
  expect(css).toContain(".metric.metric{grid-column:1/-1;display:grid");
 });
});
