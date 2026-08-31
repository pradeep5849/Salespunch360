import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:vi.fn()}));
import { createLeadForActor } from "./service";

describe("lead creation restrictions",()=>{
  it("rejects standalone lead creation by SALES before any database work",async()=>{
    await expect(createLeadForActor({id:"sales",name:"Sales",email:"s@example.com",role:"SALES",companyId:"company"},{title:"Bypass",assignedUserId:"sales"})).rejects.toThrow("NOT_FOUND");
  });
});
