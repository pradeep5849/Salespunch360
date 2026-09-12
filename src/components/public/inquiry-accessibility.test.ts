import {describe,expect,it} from "vitest";
import {inquiryErrorAttributes} from "./inquiry-accessibility";

describe("public inquiry error associations",()=>{
  it.each(["name","company","email","phone","product","teamSize","message"])("associates %s with its error",name=>expect(inquiryErrorAttributes(name,true)).toEqual({"aria-invalid":true,"aria-describedby":`${name}-error`}));
  it("does not reference a missing error",()=>expect(inquiryErrorAttributes("email",false)).toEqual({"aria-invalid":false}));
});
