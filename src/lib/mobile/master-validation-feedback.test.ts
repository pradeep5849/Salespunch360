import {expect,it} from "vitest";
import {z} from "zod";
import {masterValidationFeedback} from "./master-validation-feedback";
it("returns field validation for a required custom field without exposing exception details",()=>{
 expect(masterValidationFeedback(new Error("CUSTOM_FIELDS_REQUIRED:reference"))).toEqual({error:"INVALID_INPUT",message:"This custom field is required.",fields:{"customFields.reference":["This custom field is required."]}});
});
it("maps invalid typed custom values to the same recoverable input contract",()=>expect(masterValidationFeedback(new Error("INVALID_CUSTOM_FIELD:date"))).toMatchObject({error:"INVALID_INPUT",fields:{"customFields.date":[expect.any(String)]}}));
it("retains normal input and schema error behavior",()=>{
 expect(masterValidationFeedback(new Error("INVALID_INPUT"))).toEqual({error:"INVALID_INPUT"});
 const parsed=z.object({name:z.string()}).safeParse({name:42});expect(parsed.success).toBe(false);if(!parsed.success)expect(masterValidationFeedback(parsed.error)).toMatchObject({error:"INVALID_INPUT",fields:{name:[expect.any(String)]}});
});
it("does not turn authorization, database or unknown exceptions into successful input validation",()=>{
 for(const value of [new Error("MOBILE_FORBIDDEN"),new Error("P2022"),new Error("internal secret details"),null,"INVALID_INPUT"])expect(masterValidationFeedback(value)).toBeNull();
});
