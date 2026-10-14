import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({post:vi.fn(),prepare:vi.fn(),attach:vi.fn(),refresh:vi.fn(),actor:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:m.refresh}));
vi.mock("@/lib/auth/authorization",async original=>({...await original<typeof import("@/lib/auth/authorization")>(),requirePermissionForMutation:m.actor}));
vi.mock("@/lib/account/money",async original=>({...await original<typeof import("@/lib/account/money")>(),createMoneyTransferForActor:m.post}));
vi.mock("@/lib/account/money-transfer-image",()=>({prepareTransferImage:m.prepare,addTransferImageForActor:m.attach}));
import {transferAction} from "./money";
beforeEach(()=>{vi.resetAllMocks();m.actor.mockResolvedValue({id:"actor",companyId:"company"});m.post.mockResolvedValue({id:"transfer"});m.prepare.mockResolvedValue({hash:"prepared"})});
const form=()=>{const data=new FormData();data.set("idempotencyKey","same-financial-request");data.set("image",new File(["pixels"],"proof.png",{type:"image/png"}));return data};
describe("transfer image action financial boundaries",()=>{
 it("validates an image before any financial posting",async()=>{m.prepare.mockRejectedValue(new Error("INVALID_TRANSFER_IMAGE"));await expect(transferAction(form())).rejects.toThrow("INVALID_TRANSFER_IMAGE");expect(m.post).not.toHaveBeenCalled();expect(m.attach).not.toHaveBeenCalled()});
 it("reports posted status after upload failure and preserves the financial retry key",async()=>{m.attach.mockRejectedValue(new Error("STORAGE_UNAVAILABLE"));const data=form();for(let retry=0;retry<2;retry++)await expect(transferAction(data)).rejects.toThrow("TRANSFER_POSTED_IMAGE_UPLOAD_FAILED");expect(m.post.mock.calls.map(call=>call[1].idempotencyKey)).toEqual(["same-financial-request","same-financial-request"]);expect(m.attach.mock.calls.every(call=>call[1]==="transfer")).toBe(true);expect(m.refresh).toHaveBeenCalled()});
 it("attaches to the actual saved transfer after successful posting",async()=>{await transferAction(form());expect(m.attach).toHaveBeenCalledWith({id:"actor",companyId:"company"},"transfer",{hash:"prepared"});expect(m.prepare.mock.invocationCallOrder[0]).toBeLessThan(m.post.mock.invocationCallOrder[0]);expect(m.post.mock.invocationCallOrder[0]).toBeLessThan(m.attach.mock.invocationCallOrder[0])});
});
