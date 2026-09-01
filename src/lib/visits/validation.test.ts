import { describe, expect, it } from "vitest";
import { checkInSchema, checkoutSchema,fieldCheckInSchema } from "./validation";
import{isCompleteCheckInReference}from"./service";

const location={latitude:40,longitude:-74,accuracyMeters:10};
describe("customer visit validation",()=>{
  it("requires GPS for every check-in and checkout",()=>{expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111"}).success).toBe(false);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",sentiment:"NEUTRAL"}).success).toBe(false)});
  it("accepts valid visit payloads",()=>{expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111",location,visitNotes:"Meeting"}).success).toBe(true);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"POSITIVE",remarks:"Good"}).success).toBe(true)});
  it("rejects invalid sentiment and oversized remarks",()=>{expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"HAPPY"}).success).toBe(false);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"NEUTRAL",remarks:"x".repeat(2001)}).success).toBe(false)});
  it.each(["companyId","userId","attendanceId","checkedInAt","checkedOutAt"])("rejects browser-controlled %s",field=>expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111",location,[field]:"controlled"}).success).toBe(false));
  it("validates W5A subjects without photo data persistence",()=>{expect(fieldCheckInSchema.safeParse({visitType:"NEW",name:"Prospect",location}).success).toBe(true);expect(fieldCheckInSchema.safeParse({visitType:"FOLLOW_UP",leadId:"11111111-1111-4111-8111-111111111111",location}).success).toBe(true);expect(fieldCheckInSchema.safeParse({visitType:"CUSTOMER",customerId:"11111111-1111-4111-8111-111111111111",location}).success).toBe(true);expect(fieldCheckInSchema.safeParse({visitType:"NEW",name:"Prospect",location,photoDataUrl:"data:image/png;base64,x"}).success).toBe(false)});
  it("does not treat partial reference state as established",()=>{const complete={checkInReferenceLatitude:1,checkInReferenceLongitude:2,checkInReferenceVisitId:"v",checkInReferenceSetAt:new Date()};expect(isCompleteCheckInReference(complete)).toBe(true);for(const key of Object.keys(complete))expect(isCompleteCheckInReference({...complete,[key]:null})).toBe(false)});
});
