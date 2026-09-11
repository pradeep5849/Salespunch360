import{beforeEach,describe,expect,it,vi}from"vitest";
const m=vi.hoisted(()=>({auth:vi.fn(),modules:vi.fn(),doc:vi.fn(),create:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{constructor(){super("Not authorized")}},requirePermission:m.auth,requirePermissionForMutation:m.auth}));vi.mock("./modules",()=>({requireAccountModules:m.modules}));vi.mock("@/lib/accounting/service",()=>({postJournalInTx:vi.fn()}));vi.mock("@/lib/db",()=>({db:{commercialDocument:{findFirst:m.doc},paymentReminder:{create:m.create},commercialAuditEvent:{create:m.audit}}}));
import{schedulePaymentReminder}from"./commercial";
const actor=(accountRole:string)=>({id:"u",companyId:"11111111-1111-4111-8111-111111111111",accountRole,branchAccessScope:"ALL_BRANCHES",branchIds:[]}),input={documentId:"22222222-2222-4222-8222-222222222222",remindAt:"2026-09-12T10:00:00Z",message:"Please pay"};
beforeEach(()=>{vi.clearAllMocks();m.doc.mockResolvedValue({id:input.documentId,customerId:"c"});m.create.mockResolvedValue({id:"r"})});
describe("payment reminder runtime authority",()=>{
 it.each(["DATA_ENTRY","PROJECT_MANAGER"])("blocks %s server-side",async role=>{m.auth.mockResolvedValue(actor(role));await expect(schedulePaymentReminder(input)).rejects.toThrow("Not authorized");expect(m.doc).not.toHaveBeenCalled()});
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT"])("allows %s with module and posted-invoice checks",async role=>{m.auth.mockResolvedValue(actor(role));await expect(schedulePaymentReminder(input)).resolves.toEqual({id:"r"});expect(m.modules).toHaveBeenCalledWith(expect.anything(),"SALES","PAYMENT_REMINDERS");expect(m.doc).toHaveBeenCalledWith({where:expect.objectContaining({companyId:actor(role).companyId,type:"SALES_INVOICE",status:"POSTED"})})});
});
