import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source=readFileSync("src/app/register/registration-form.tsx","utf8");
describe("public F4 registration",()=>{
  it.each(["SALESPUNCH360","SALESPUNCH360_ACCOUNT","SALESPUNCH360_PLUS"])("offers stable edition %s",edition=>expect(source).toContain(edition));
});
