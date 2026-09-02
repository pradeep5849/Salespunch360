import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const component=readFileSync("src/app/workspace/leads/pending-phone-form.tsx","utf8");
describe("Pending add-phone form",()=>{it("renders the sanitized server-action error on its card",()=>{expect(component).toContain("useActionState(addPhoneToVisitFormAction");expect(component).toContain('state.error&&<p className="form-error" role="alert">{state.error}</p>')});it("prevents rapid resubmission",()=>{expect(component).toContain('disabled={pending}');expect(component).toContain('pending?"Adding…":"Add phone"')})});
