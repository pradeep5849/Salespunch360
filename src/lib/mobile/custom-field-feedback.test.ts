import {expect,it} from "vitest";
import {mobileUnexpected} from "./http";
it.each(["CUSTOM_FIELDS_REQUIRED:site_reference","INVALID_CUSTOM_FIELD:measurement"])("returns a validation response for %s",async code=>{
 const response=mobileUnexpected("CUSTOM_FIELD_SAVE",new Error(code));
 expect(response.status).toBe(400);
 const body=await response.json();
 expect(body.error).toBe(code);
 expect(body.message).toMatch(/custom fields/);
 expect(body).not.toHaveProperty("referenceId");
});
