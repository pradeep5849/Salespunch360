import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({apply:vi.fn(),remind:vi.fn(),status:vi.fn(),redirect:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/account/commercial",()=>({applyAdvance:m.apply,createCommercialDocument:vi.fn(),createSettlement:vi.fn(),postCommercialDocument:vi.fn(),schedulePaymentReminder:m.remind,setPaymentReminderStatus:m.status}));
vi.mock("next/navigation",()=>({redirect:m.redirect}));vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import{applyAdvanceAction,reminderStatusAction,saveReminderAction}from"./commercial";
beforeEach(()=>{vi.clearAllMocks();m.status.mockResolvedValue({documentId:"d"})});
describe("commercial actions normal FormData contracts",()=>{
 it("applies an advance and redirects using the extracted document",async()=>{const f=new FormData;f.set("advanceId","a");f.set("documentId","d");f.set("amount","25");f.set("applicationDate","2026-09-11");f.set("idempotencyKey","key-12345");f.set("$ACTION_ID_internal","ignored");await applyAdvanceAction(f);expect(m.apply).toHaveBeenCalledWith({advanceId:"a",documentId:"d",amount:"25",applicationDate:"2026-09-11",idempotencyKey:"key-12345"});expect(m.redirect).toHaveBeenCalledWith("/workspace/account/transactions/d")});
 it("creates a reminder and revalidates its document",async()=>{const f=new FormData;f.set("documentId","d");f.set("remindAt","2026-09-12T10:00");f.set("message","Please pay");f.set("$ACTION_ID_internal","ignored");await saveReminderAction(f);expect(m.remind).toHaveBeenCalledWith({documentId:"d",remindAt:"2026-09-12T10:00",message:"Please pay"});expect(m.revalidate).toHaveBeenCalledWith("/workspace/account/transactions/d")});
 it.each(["SENT","DISMISSED"])("passes only reminder id and %s status",async status=>{const f=new FormData;f.set("id","r");f.set("status",status);f.set("extra","ignored");await reminderStatusAction(f);expect(m.status).toHaveBeenCalledWith({id:"r",status});expect(m.revalidate).toHaveBeenCalledWith("/workspace/account/transactions/d")});
});
