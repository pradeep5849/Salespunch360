import { describe, expect, it } from "vitest";
import { checkInSchema, checkoutSchema } from "./validation";

const location={latitude:40,longitude:-74,accuracyMeters:10};
describe("customer visit validation",()=>{
  it("requires GPS for every check-in and checkout",()=>{expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111"}).success).toBe(false);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",sentiment:"NEUTRAL"}).success).toBe(false)});
  it("accepts valid visit payloads",()=>{expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111",location,visitNotes:"Meeting"}).success).toBe(true);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"POSITIVE",remarks:"Good"}).success).toBe(true)});
  it("rejects invalid sentiment and oversized remarks",()=>{expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"HAPPY"}).success).toBe(false);expect(checkoutSchema.safeParse({visitId:"11111111-1111-4111-8111-111111111111",location,sentiment:"NEUTRAL",remarks:"x".repeat(2001)}).success).toBe(false)});
  it.each(["companyId","userId","attendanceId","checkedInAt","checkedOutAt"])("rejects browser-controlled %s",field=>expect(checkInSchema.safeParse({customerId:"11111111-1111-4111-8111-111111111111",location,[field]:"controlled"}).success).toBe(false));
});
