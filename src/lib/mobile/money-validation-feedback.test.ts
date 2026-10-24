import {expect,it} from "vitest";
import {z} from "zod";
import {moneyValidationFeedback} from "./money-validation-feedback";
it("provides actionable field help without echoing values or validator exception messages",()=>{
 const result=z.object({reason:z.string().min(3),amount:z.string().regex(/^\d+$/)}).safeParse({reason:" ",amount:"secret-private-value"});
 if(result.success)throw new Error("Expected validation failure");
 expect(moneyValidationFeedback(result.error)).toEqual({error:"INVALID_INPUT",message:"Enter a valid reason within the allowed length. Check the amount and use at most two decimal places.",fieldErrors:{reason:"Enter a valid reason within the allowed length.",amount:"Check the amount and use at most two decimal places."}});
 expect(JSON.stringify(moneyValidationFeedback(result.error))).not.toContain("secret-private-value");
});
it("never exposes unrecognized field names or custom messages",()=>{
 const result=z.object({privateInternalKey:z.string().refine(()=>false,"private validator detail")}).safeParse({privateInternalKey:"private input"});
 if(result.success)throw new Error("Expected validation failure");
 expect(moneyValidationFeedback(result.error)).toEqual({error:"INVALID_INPUT",message:"Check the entered details and try again.",fieldErrors:{}});
});
