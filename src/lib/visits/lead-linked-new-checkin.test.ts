import {describe,expect,it} from "vitest";
import {fieldCheckInSchema} from "./validation";

const location={latitude:12.9716,longitude:77.5946,accuracyMeters:8};

describe("lead-linked new check-in input",()=>{
 it("accepts an exact Lead id on the New check-in flow",()=>{
  const parsed=fieldCheckInSchema.parse({visitType:"NEW",name:"Existing Lead",phone:"9876543210",leadId:"11111111-1111-4111-8111-111111111111",location});
  expect(parsed.visitType).toBe("NEW");
  expect(parsed.leadId).toBe("11111111-1111-4111-8111-111111111111");
 });
 it("keeps ordinary New prospect check-ins valid without a Lead id",()=>{
  expect(fieldCheckInSchema.safeParse({visitType:"NEW",name:"New Prospect",phone:"9876543210",location}).success).toBe(true);
 });
});
