import { describe,expect,it,vi } from "vitest";
vi.mock("@/lib/db",()=>({db:{}}));
import {recyclePurgeCutoff} from "./recycle-retention";
describe("seven-day recycle retention",()=>{
 const now=new Date("2040-01-15T10:00:00Z");
 it("stays disabled until explicit activation and a full seven-day rollout grace",()=>{
  expect(recyclePurgeCutoff(undefined,now)).toBeNull();
  expect(recyclePurgeCutoff("invalid",now)).toBeNull();
  expect(recyclePurgeCutoff("2040-01-08T10:00:00.001Z",now)).toBeNull();
 });
 it("uses an inclusive seven-day cutoff at the exact boundary",()=>{
  expect(recyclePurgeCutoff("2040-01-08T10:00:00Z",now)?.toISOString()).toBe("2040-01-08T10:00:00.000Z");
 });
});
