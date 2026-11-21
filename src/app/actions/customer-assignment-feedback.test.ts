import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({assign:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/customers/service",()=>({assignCustomer:m.assign,createCustomer:vi.fn(),editCustomer:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import {assignCustomerWithFeedback} from "./customers";
beforeEach(()=>{vi.clearAllMocks();m.assign.mockReset().mockResolvedValue({})});
it("confirms assignment only after the service succeeds",async()=>{expect(await assignCustomerWithFeedback(new FormData())).toEqual({saved:true});expect(m.revalidate).toHaveBeenCalled()});
it("reports the concurrent-assignment conflict without claiming success",async()=>{m.assign.mockRejectedValueOnce(new Error("CUSTOMER_ALREADY_ASSIGNED"));expect(await assignCustomerWithFeedback(new FormData())).toEqual({saveError:"CUSTOMER_ALREADY_ASSIGNED"});expect(m.revalidate).not.toHaveBeenCalled()});
