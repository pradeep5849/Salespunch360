import { describe, expect, it } from "vitest";
import { createCustomerSchema, editCustomerSchema } from "./validation";

const valid = { name: "Acme Retail", contactPerson: "Ada", phone: "+1 202-555-0110", email: "BUYER@ACME.COM", address: "10 Market Street", latitude: "40.7", longitude: "-74" };
describe("customer validation", () => {
  it("normalizes customer contact data and coordinates", () => { const value=createCustomerSchema.parse(valid); expect(value.email).toBe("buyer@acme.com"); expect(value.phone).toBe("+12025550110"); expect(value.latitude).toBe(40.7); });
  it("requires both reference coordinates", () => { expect(createCustomerSchema.safeParse({...valid,longitude:""}).success).toBe(false); });
  it("rejects invalid reference coordinates",()=>{expect(createCustomerSchema.safeParse({...valid,latitude:"91"}).success).toBe(false)});
  it.each(["companyId","userId","role"])("rejects client-controlled %s",field=>expect(createCustomerSchema.safeParse({...valid,[field]:"controlled"}).success).toBe(false));
  it("requires a valid customer id for editing",()=>expect(editCustomerSchema.safeParse({customerId:"other",...valid}).success).toBe(false));
});
