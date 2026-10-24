import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({create:vi.fn(),revalidate:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
vi.mock("@/lib/account/service",()=>({createPartyWithCustomValues:mocks.create}));
import {saveNewAccountPartyAction} from "./account-masters";
const branch="22222222-2222-4222-8222-222222222222";
function form(){const data=new FormData();data.set("branchId",branch);data.set("name"," New party ");data.set("contactPerson"," Contact ");data.set("custom_reference","required value");return data}
beforeEach(()=>{vi.clearAllMocks();mocks.create.mockResolvedValue({id:"created"})});
it("returns committed party identity for selection and preserves the required-field/branch service boundary",async()=>{
 const data=form(),result=await saveNewAccountPartyAction(data);
 expect(mocks.create).toHaveBeenCalledWith("customers",Object.fromEntries(data),{reference:"required value"},branch);
 expect(result).toMatchObject({kind:"success",createdParty:{id:"created",name:"New party",contactPerson:"Contact",branchId:branch}});
});
it("returns no selectable identity after an authorization or custom-field failure",async()=>{
 mocks.create.mockRejectedValue(new Error("CUSTOM_FIELD_REQUIRED"));const result=await saveNewAccountPartyAction(form());
 expect(result.kind).toBe("error");expect(result).not.toHaveProperty("createdParty");expect(mocks.revalidate).not.toHaveBeenCalled();
});
it("rejects malformed branch before invoking the existing mutation service",async()=>{
 const data=form();data.set("branchId","foreign-input");const result=await saveNewAccountPartyAction(data);
 expect(result.kind).toBe("error");expect(mocks.create).not.toHaveBeenCalled();expect(result).not.toHaveProperty("createdParty");
});
