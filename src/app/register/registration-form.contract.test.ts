import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source=readFileSync("src/app/register/registration-form.tsx","utf8");
describe("public F4 registration",()=>{
  it("offers only the production Sales product",()=>{expect(source).toContain('value="SALESPUNCH360"');expect(source).not.toContain("SALESPUNCH360_ACCOUNT");expect(source).not.toContain("SALESPUNCH360_PLUS");expect(source).not.toContain("SalesPunch360 Account");});
});
