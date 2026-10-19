vi.mock("./stock-options",()=>({quotationStockOptionsForActor:vi.fn(async()=>null)}));
import {requireAccountModules} from "@/lib/account/modules";
import {beforeEach,describe,expect,it,vi} from "vitest";import {Prisma} from "@prisma/client";
const C="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222",ID="33333333-3333-4333-8333-333333333333",R="44444444-4444-4444-8444-444444444444";
const m=vi.hoisted(()=>({auth:vi.fn(),allocate:vi.fn(),visibility:vi.fn(()=>({assignedUserId:"actor"})),txRun:vi.fn(),branch:vi.fn(),customer:vi.fn(),company:vi.fn(),lead:vi.fn(),product:vi.fn(),service:vi.fn(),work:vi.fn(),unit:vi.fn(),docCreate:vi.fn(),docFind:vi.fn(),docMany:vi.fn(),docUpdateMany:vi.fn(),revisionCreate:vi.fn(),revisionFind:vi.fn(),revisionUpdate:vi.fn(),revisionDelete:vi.fn(),lineCreate:vi.fn(),lineDelete:vi.fn(),adjustCreate:vi.fn(),adjustDelete:vi.fn(),paymentCreate:vi.fn(),paymentDelete:vi.fn(),auditCreate:vi.fn(),shareCreate:vi.fn(),shareFind:vi.fn(),shareUpdateMany:vi.fn(),raw:vi.fn(),listDocs:vi.fn(),branches:vi.fn(),customers:vi.fn(),products:vi.fn(),services:vi.fn(),works:vi.fn(),units:vi.fn(),leads:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({requirePermission:m.auth,requirePermissionForMutation:m.auth}));vi.mock("@/lib/account/numbering",()=>({allocateDocumentNumberInTx:m.allocate}));vi.mock("@/lib/account/modules",()=>({requireAccountModules:vi.fn()}));vi.mock("@/lib/leads/policy",()=>({visibilityWhere:m.visibility}));
const customModels=vi.hoisted(()=>({accountSettings:{findUnique:vi.fn(async()=>null)},customFieldDefinition:{findMany:vi.fn(async()=>[])},customFieldValue:{findMany:vi.fn(async()=>[]),deleteMany:vi.fn(async()=>({count:0}))}}));
const tx={...customModels,branch:{findFirst:m.branch},customer:{findFirst:m.customer},company:{findUnique:m.company},lead:{findFirst:m.lead},accountProduct:{findFirst:m.product},accountService:{findFirst:m.service},workPackage:{findFirst:m.work},accountUnit:{findFirst:m.unit},quotationDocument:{create:m.docCreate,findFirst:m.docFind,updateMany:m.docUpdateMany},quotationRevision:{create:m.revisionCreate,findFirst:m.revisionFind,update:m.revisionUpdate,delete:m.revisionDelete},quotationLine:{createMany:m.lineCreate,deleteMany:m.lineDelete},quotationAdjustment:{createMany:m.adjustCreate,deleteMany:m.adjustDelete},quotationPaymentSchedule:{createMany:m.paymentCreate,deleteMany:m.paymentDelete},quotationAuditEvent:{create:m.auditCreate},quotationShare:{create:m.shareCreate,findFirst:m.shareFind,updateMany:m.shareUpdateMany},$queryRaw:m.raw};
vi.mock("@/lib/db",()=>({db:{...customModels,$transaction:m.txRun,quotationDocument:{findMany:m.listDocs,findFirst:m.docFind,fields:{currentRevisionNumber:"currentRevisionNumber"}},quotationRevision:{findFirst:m.revisionFind},quotationShare:{findFirst:m.shareFind},company:{findUniqueOrThrow:m.company},branch:{findMany:m.branches},customer:{findMany:m.customers},accountProduct:{findMany:m.products},accountService:{findMany:m.services},workPackage:{findMany:m.works},accountUnit:{findMany:m.units},lead:{findMany:m.leads}}}));
import {createQuotation,createQuotationRevision,createShare,getPublicQuotation,getQuotation,listQuotations,quotationEditorOptions,revokeShare,transitionQuotation,updateQuotationDraft} from "./service";
const actor=(role:"ACCOUNT_ADMIN"|"ACCOUNTANT"|"PROJECT_MANAGER"|"DATA_ENTRY"="ACCOUNT_ADMIN",extra={})=>({id:"actor",name:"Actor",email:"actor@example.test",role:"ACCOUNT_USER" as const,isActive:true,managerType:null,companyId:C,accountRole:role,accountAccessActive:true,salesAccessActive:false,salesRole:null,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[],...extra});
const input=(overrides:Record<string,unknown>={})=>({branchId:B,documentType:"QUOTATION",customerId:ID,issueDate:"2026-09-10",lines:[{lineType:"CUSTOM",itemName:"Work",quantity:"1",rate:"100",taxRate:"18"}],adjustments:[],paymentSchedule:[],...overrides});
const customer={name:"Acme",contactPerson:"P",phone:"1",email:"a@b.c",billingAddress:"Bill",shippingAddress:"Site",address:null,gstin:null,pan:null};
const revision=(status="DRAFT")=>({id:R,companyId:C,documentId:ID,revisionNumber:0,status,issueDate:new Date(),validUntil:null,customerName:"Acme",contactPerson:null,phone:null,email:null,billingAddress:null,siteAddress:null,gstin:null,pan:null,terms:null,inclusions:null,exclusions:null,notes:null,subtotal:new Prisma.Decimal(100),discountTotal:new Prisma.Decimal(0),additionalChargeTotal:new Prisma.Decimal(0),taxableTotal:new Prisma.Decimal(100),taxTotal:new Prisma.Decimal(18),grandTotal:new Prisma.Decimal(118),internalCostTotal:new Prisma.Decimal(0),expectedProfit:new Prisma.Decimal(100),expectedMarginPercent:new Prisma.Decimal(100),lines:[{id:"55555555-5555-4555-8555-555555555555",lineType:"CUSTOM",productId:null,serviceId:null,workPackageId:null,quantity:"1",rate:"100",taxRate:"18",internalUnitCost:new Prisma.Decimal(0),internalCostTotal:new Prisma.Decimal(0)}],adjustments:[],paymentSchedule:[],shares:[]});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAccountModules).mockReset();vi.mocked(requireAccountModules).mockResolvedValue(undefined);m.auth.mockResolvedValue(actor());m.txRun.mockImplementation((fn:unknown)=>typeof fn==="function"?(fn as (x:typeof tx)=>unknown)(tx):fn);m.branch.mockResolvedValue({id:B});m.customer.mockResolvedValue(customer);m.company.mockResolvedValue({productEdition:"SALESPUNCH360_PLUS"});m.allocate.mockResolvedValue("Q-000001");m.docCreate.mockResolvedValue({id:ID});m.revisionCreate.mockResolvedValue({id:R});m.docUpdateMany.mockResolvedValue({count:1});m.shareUpdateMany.mockResolvedValue({count:1});m.raw.mockResolvedValue([]);m.branches.mockResolvedValue([]);m.customers.mockResolvedValue([]);m.products.mockResolvedValue([]);m.services.mockResolvedValue([]);m.works.mockResolvedValue([]);m.units.mockResolvedValue([]);m.leads.mockResolvedValue([])});
describe("A3 service runtime create and authorization",()=>{
 it("requires Account product permission",async()=>{m.auth.mockRejectedValue(new Error("Not authorized"));await expect(createQuotation(input())).rejects.toThrow("Not authorized")});
 it("denies a Sales-only identity at the Account boundary",async()=>{m.auth.mockRejectedValue(new Error("Not authorized"));await expect(createQuotation(input())).rejects.toThrow()});
 it("rejects an unauthorized or cross-company Branch",async()=>{m.branch.mockResolvedValue(null);await expect(createQuotation(input())).rejects.toThrow("INVALID_BRANCH")});
 it("rejects a cross-company Customer",async()=>{m.customer.mockResolvedValue(null);await expect(createQuotation(input())).rejects.toThrow("INVALID_CUSTOMER")});
 it.each([["PRODUCT","product"],["SERVICE","service"],["WORK_PACKAGE","work"]] as const)("rejects a cross-company %s",async(type,key)=>{m[key].mockResolvedValue(null);await expect(createQuotation(input({lines:[{lineType:type,sourceId:ID,quantity:"1"}]}))).rejects.toThrow("INVALID_LINE_REFERENCE")});
 it("rejects a cross-company Unit",async()=>{m.unit.mockResolvedValue(null);await expect(createQuotation(input({lines:[{lineType:"CUSTOM",itemName:"X",unitId:ID,quantity:"1",rate:"1"}]}))).rejects.toThrow("INVALID_UNIT")});
 it("uses the shared allocator and writes snapshots",async()=>{await createQuotation(input());expect(m.allocate).toHaveBeenCalledWith(tx,expect.objectContaining({companyId:C,branchId:B,seriesKey:"QUOTATION"}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({itemName:"Work",quantity:"1",rate:"100",taxAmount:expect.anything()})]})});
 it("persists only valid QuotationLine calculation fields",async()=>{await createQuotation(input({adjustments:[{type:"DISCOUNT",label:"D",valueType:"FIXED",value:"10"}]}));const row=m.lineCreate.mock.calls[0][0].data[0];expect(row).not.toHaveProperty("documentDiscountAmount");expect(row).not.toHaveProperty("taxableBeforeDocumentDiscount");for(const key of ["baseAmount","discountAmount","taxableAmount","taxRate","taxAmount","lineTotal","internalCostTotal"])expect(row).toHaveProperty(key)});
 it("requires the Account Customer to belong to the quotation Branch",async()=>{await createQuotation(input());expect(m.customer).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:C,id:ID,branchId:B,isActive:true,isAccountCustomer:true})}))});
 it("rejects a same-company Customer from another Branch without leaking its existence",async()=>{m.customer.mockResolvedValue(null);await expect(createQuotation(input())).rejects.toThrow("INVALID_CUSTOMER");expect(m.docCreate).not.toHaveBeenCalled()});
});
describe("Account Customer Branch options",()=>{
 it("scopes selected-Branch options and returns only the authorized query result",async()=>{const own={id:ID,name:"Branch A",contactPerson:null};m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN",{branchAccessScope:"SELECTED_BRANCHES",branchIds:[B]}));m.customers.mockResolvedValue([own]);const result=await quotationEditorOptions();expect(result.customers).toEqual([own]);expect(m.customers).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:C,isActive:true,isAccountCustomer:true,branchId:{in:[B]}}}))});
 it("cannot include another Branch through a crafted selector",async()=>{m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN",{branchAccessScope:"SELECTED_BRANCHES",branchIds:[B]}));await quotationEditorOptions();expect(m.customers.mock.calls[0][0].where.branchId).toEqual({in:[B]})});
 it("includes safe branch identity in customer choices for client-side branch selection",async()=>{
  await quotationEditorOptions();
  expect(m.customers.mock.calls[0][0].select).toEqual({id:true,name:true,contactPerson:true,phone:true,branchId:true});
 });
 it("retains all company Account customers for ALL_BRANCHES",async()=>{const rows=[{id:ID,name:"A"},{id:R,name:"B"}];m.customers.mockResolvedValue(rows);const result=await quotationEditorOptions();expect(result.customers).toEqual(rows);expect(m.customers.mock.calls[0][0].where).toEqual({companyId:C,isActive:true,isAccountCustomer:true})});
});
describe("Plus Lead boundary",()=>{
 const leadInput=()=>input({customerId:undefined,sourceLeadId:ID});
 it("denies Account-only identity",async()=>{await expect(createQuotation(leadInput())).rejects.toThrow("LEAD_ACCESS_REQUIRED")});
 it("denies Lead use outside Plus",async()=>{m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN",{salesAccessActive:true,salesRole:"ADMIN"}));m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT"});await expect(createQuotation(leadInput())).rejects.toThrow("PLUS_LEAD_REQUIRED")});
 it("allows an authorized Plus Lead and applies existing visibility scope without mutation",async()=>{m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN",{salesAccessActive:true,salesRole:"MANAGER"}));m.lead.mockResolvedValue({companyName:"Lead Co",title:"Lead",contactName:"C",phone:"1",email:null});await createQuotation(leadInput());expect(m.visibility).toHaveBeenCalled();expect(m.lead).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:C,branchId:B,assignedUserId:"actor"})}));expect(m.lead).not.toHaveBeenCalledWith(expect.objectContaining({data:expect.anything()}))});
 it("rejects a cross-company or invisible Lead",async()=>{m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN",{salesAccessActive:true,salesRole:"ADMIN"}));m.lead.mockResolvedValue(null);await expect(createQuotation(leadInput())).rejects.toThrow("INVALID_LEAD")});
});
describe("cost, draft, revision and lifecycle",()=>{
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT","PROJECT_MANAGER"] as const)("allows %s cost override",async role=>{m.auth.mockResolvedValue(actor(role));await createQuotation(input({lines:[{lineType:"CUSTOM",itemName:"X",quantity:"1",rate:"100",internalUnitCost:"60"}]}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"60"})]})});
 it("rejects Data Entry cost override",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));await expect(createQuotation(input({lines:[{lineType:"CUSTOM",itemName:"X",quantity:"1",rate:"1",internalUnitCost:"1"}]}))).rejects.toThrow("QUOTATION_COST_PERMISSION_REQUIRED")});
 it("preserves hidden custom cost across Data Entry Draft edit",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));const old=revision();old.lines[0].internalUnitCost=new Prisma.Decimal(60);m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"DRAFT",revisions:[old]});await updateQuotationDraft(ID,input({lines:[{existingLineId:old.lines[0].id,lineType:"CUSTOM",itemName:"Work",description:"Changed",quantity:"1",rate:"100"}]}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"60",description:"Changed"})]})});
 it("uses zero for a new Data Entry custom line",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));await createQuotation(input());expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"0"})]})});
 it("uses master cost internally but does not expose it in Data Entry options",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));m.product.mockResolvedValue({id:ID,name:"P",code:null,description:null,salePrice:new Prisma.Decimal(100),costPrice:new Prisma.Decimal(60),taxRate:new Prisma.Decimal(18),unit:null});await createQuotation(input({lines:[{lineType:"PRODUCT",sourceId:ID,quantity:"1"}]}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"60"})]});m.products.mockResolvedValue([{id:ID,name:"P",costPrice:60}]);m.services.mockResolvedValue([{id:ID,name:"S",estimatedCost:50}]);m.works.mockResolvedValue([{id:ID,name:"W",estimatedCost:40}]);expect(JSON.stringify(await quotationEditorOptions())).not.toMatch(/costPrice|estimatedCost|internalUnitCost|internalCostTotal|expectedProfit|expectedMarginPercent/)});
 it("does not carry hidden cost when line identity changes",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));const old=revision();old.lines[0].internalUnitCost=new Prisma.Decimal(60);m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"DRAFT",revisions:[old]});m.product.mockResolvedValue({id:ID,name:"P",code:null,description:null,salePrice:new Prisma.Decimal(100),costPrice:new Prisma.Decimal(25),taxRate:null,unit:null});await updateQuotationDraft(ID,input({lines:[{existingLineId:old.lines[0].id,lineType:"PRODUCT",sourceId:ID,quantity:"1"}]}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"25"})]})});
 it("strips list cost totals for Data Entry",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));m.listDocs.mockResolvedValue([{id:ID,revisions:[{grandTotal:118,internalCostTotal:60,expectedProfit:40,expectedMarginPercent:40}]}]);expect(JSON.stringify(await listQuotations())).not.toMatch(/internalCost|expectedProfit|expectedMargin/)});
 it("never sends hidden cost through Data Entry detail/preload",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));const old=revision();old.lines[0].internalUnitCost=new Prisma.Decimal(60);m.docFind.mockResolvedValue({id:ID,status:"DRAFT",revisions:[old],branch:{},company:{},audits:[]});const json=JSON.stringify(await getQuotation(ID));expect(json).not.toMatch(/internalUnitCost|internalCostTotal|expectedProfit|expectedMarginPercent/)});
 it("records a scoped safe draft edit event in the replacement transaction",async()=>{
  m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"DRAFT",revisions:[revision()]});
  await updateQuotationDraft(ID,input());
  expect(m.auditCreate).toHaveBeenCalledWith({data:{companyId:C,documentId:ID,actorId:"actor",eventType:"DRAFT_UPDATED",revisionNumber:0,note:"Draft saved: 1 lines; 0 adjustments; 0 payment schedule entries."}});
  expect(m.docUpdateMany).toHaveBeenCalledWith({where:{id:ID,companyId:C,status:"DRAFT"},data:{updatedAt:expect.any(Date)}});
 });
 it("edits Draft by deleting children then recreating, but rejects issued",async()=>{m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"DRAFT",revisions:[revision()]});await updateQuotationDraft(ID,input());expect(m.revisionDelete).toHaveBeenCalledWith({where:{id:R}});m.docFind.mockResolvedValue(null);await expect(updateQuotationDraft(ID,input())).rejects.toThrow("DRAFT_NOT_EDITABLE")});
 it("preserves old revisions and creates the next under a lock",async()=>{m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"APPROVED",currentRevisionNumber:0,revisions:[revision("APPROVED")]});await createQuotationRevision(ID,input());expect(m.raw).toHaveBeenCalled();expect(m.revisionDelete).not.toHaveBeenCalled();expect(m.revisionCreate).toHaveBeenCalledWith({data:expect.objectContaining({revisionNumber:1})})});
 it.each([["draft",updateQuotationDraft,"DRAFT"],["revision",createQuotationRevision,"APPROVED"]] as const)("%s cannot bypass Customer Branch validation",async(_,operation,status)=>{m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status,currentRevisionNumber:0,revisions:[revision(status)]});m.customer.mockResolvedValue(null);await expect(operation(ID,input())).rejects.toThrow("INVALID_CUSTOMER");expect(m.customer).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:C,id:ID,branchId:B})}))});
 it("rejects revision identity changes",async()=>{m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"APPROVED",currentRevisionNumber:0});await expect(createQuotationRevision(ID,input({branchId:ID}))).rejects.toThrow("DOCUMENT_IDENTITY_IMMUTABLE")});
 it("requires approval permission and rejects invalid transitions",async()=>{m.auth.mockRejectedValue(new Error("Not authorized"));await expect(transitionQuotation(ID,"APPROVED")).rejects.toThrow();m.auth.mockResolvedValue(actor());m.docFind.mockResolvedValue({id:ID,status:"ACCEPTED",revisions:[revision("ACCEPTED")],branch:{},company:{},audits:[]});await expect(transitionQuotation(ID,"SENT")).rejects.toThrow("INVALID_TRANSITION")});
 it("preserves hidden cost into a Data Entry revision",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));const old=revision("APPROVED");old.lines[0].internalUnitCost=new Prisma.Decimal(60);m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"APPROVED",currentRevisionNumber:0,revisions:[old]});await createQuotationRevision(ID,input({lines:[{existingLineId:old.lines[0].id,lineType:"CUSTOM",itemName:"Work",quantity:"1",rate:"100"}]}));expect(m.lineCreate).toHaveBeenCalledWith({data:[expect.objectContaining({internalUnitCost:"60"})]})});
 it("prevents Data Entry from changing issued lifecycle",async()=>{m.auth.mockResolvedValue(actor("DATA_ENTRY"));m.docFind.mockResolvedValue({id:ID,status:"APPROVED",revisions:[revision("APPROVED")],branch:{},company:{},audits:[]});await expect(transitionQuotation(ID,"ACCEPTED")).rejects.toThrow("QUOTATION_LIFECYCLE_PERMISSION_REQUIRED");expect(m.docUpdateMany).not.toHaveBeenCalled()});
 it("loads children in deterministic position order",async()=>{m.docFind.mockResolvedValue({id:ID,status:"ACCEPTED",revisions:[revision("ACCEPTED")],branch:{},company:{},audits:[]});await expect(transitionQuotation(ID,"SENT")).rejects.toThrow();const include=m.docFind.mock.calls[0][0].include.revisions.include;expect(include.lines.orderBy).toEqual({position:"asc"});expect(include.adjustments.orderBy).toEqual({position:"asc"});expect(include.paymentSchedule.orderBy).toEqual({position:"asc"})});
});
describe("share concurrency and public DTO",()=>{
 it("locks and conditionally moves APPROVED to SENT",async()=>{m.docFind.mockResolvedValue({id:ID,status:"APPROVED",revisions:[revision("APPROVED")],branch:{},company:{},audits:[]});const token=await createShare(ID);expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);expect(m.raw).toHaveBeenCalled();expect(m.docUpdateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:"APPROVED"})}));expect(m.shareCreate.mock.calls[0][0].data).toHaveProperty("tokenHash");expect(m.shareCreate.mock.calls[0][0].data).not.toHaveProperty("token")});
 it("cannot regress accepted/cancelled state during share",async()=>{m.docFind.mockResolvedValue({id:ID,status:"ACCEPTED",revisions:[revision("ACCEPTED")],branch:{},company:{},audits:[]});await expect(createShare(ID)).rejects.toThrow("APPROVAL_REQUIRED");expect(m.docUpdateMany).not.toHaveBeenCalled()});
 it("revocation is idempotent and audits once",async()=>{m.shareFind.mockResolvedValue({id:ID,companyId:C,revision:{documentId:ID,revisionNumber:0}});m.shareUpdateMany.mockResolvedValueOnce({count:1}).mockResolvedValueOnce({count:0});expect(await revokeShare(ID)).toBe(true);expect(await revokeShare(ID)).toBe(false);expect(m.auditCreate).toHaveBeenCalledTimes(1)});
 it("returns only the explicit public DTO independently of authenticated module navigation",async()=>{vi.mocked(requireAccountModules).mockRejectedValue(new Error("MODULE_DISABLED:QUOTATIONS_BOQ"));m.shareFind.mockResolvedValue({revision:{revisionNumber:0,customerName:"Acme",document:{documentType:"QUOTATION",documentNumber:"Q-1",company:{name:"Safe"},branch:{name:"Main"}},lines:[],adjustments:[],paymentSchedule:[]}});const result=await getPublicQuotation("token");expect(requireAccountModules).not.toHaveBeenCalled();const json=JSON.stringify(result);expect(json).toContain("Safe");expect(json).not.toMatch(/companyId|customerId|sourceLeadId|createdById|logoObjectKey|subscriptionStatus|internalCost|expectedProfit/);expect(m.shareFind).toHaveBeenCalledWith(expect.objectContaining({select:expect.anything()}))});
});

describe("A083 authenticated quotation read module boundary",()=>{
 it.each(["list","detail","options","customer"])("denies %s before reading quotation data when the module is unavailable",async(mode)=>{
  vi.mocked(requireAccountModules).mockRejectedValueOnce(new Error("MODULE_DISABLED:QUOTATIONS_BOQ"));
  const {listQuotationsForActor,getQuotationForActor,quotationEditorOptionsForActor,getCustomerQuotationForActor}=await import("./service");
  const operation=mode==="list"?listQuotationsForActor(actor()):mode==="detail"?getQuotationForActor(actor(),ID):mode==="options"?quotationEditorOptionsForActor(actor()):getCustomerQuotationForActor(actor(),ID);
  await expect(operation).rejects.toThrow("MODULE_DISABLED:QUOTATIONS_BOQ");
  expect(m.docFind).not.toHaveBeenCalled();expect(m.docMany).not.toHaveBeenCalled();expect(m.listDocs).not.toHaveBeenCalled();expect(m.products).not.toHaveBeenCalled();expect(m.revisionFind).not.toHaveBeenCalled();
 });
});

describe("A082 inline party creation eligibility",()=>{
 it("includes required active company customer fields only for a master-writing role",async()=>{
  m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN"));const result=await quotationEditorOptions();expect(result.partyCreation).toBeDefined();
  expect(customModels.customFieldDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{companyId:C,entityType:"CUSTOMER",isActive:true}}));
  expect(customModels.accountSettings.findUnique).toHaveBeenCalledWith({where:{companyId:C},select:{transactionDefaults:true}});
 });
 it("does not expose creation fields/settings to Project Managers",async()=>{
  m.auth.mockResolvedValue(actor("PROJECT_MANAGER"));expect((await quotationEditorOptions()).partyCreation).toBeUndefined();expect(customModels.accountSettings.findUnique).not.toHaveBeenCalled();
  expect(customModels.customFieldDefinition.findMany).not.toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({entityType:"CUSTOMER"})}));
 });
});

describe("A082 client-safe exact item selector amounts",()=>{
 it("returns exact strings for product/service/package money and taxes instead of Decimal instances",async()=>{
  m.products.mockResolvedValue([{id:ID,name:"Product",salePrice:new Prisma.Decimal("90071992547409.91"),costPrice:new Prisma.Decimal("60.12"),taxRate:new Prisma.Decimal("18")}]);
  m.services.mockResolvedValue([{id:ID,name:"Service",sellingRate:new Prisma.Decimal("118.01"),estimatedCost:new Prisma.Decimal("50.02"),taxRate:new Prisma.Decimal("18")}]);
  m.works.mockResolvedValue([{id:ID,name:"Package",sellingRate:new Prisma.Decimal("333.33"),estimatedCost:new Prisma.Decimal("222.22")}]);
  const result=await quotationEditorOptions();expect(result.products[0]).toMatchObject({salePrice:"90071992547409.91",costPrice:"60.12",taxRate:"18"});expect(result.services[0]).toMatchObject({sellingRate:"118.01",estimatedCost:"50.02",taxRate:"18"});expect(result.workPackages[0]).toMatchObject({sellingRate:"333.33",estimatedCost:"222.22"});
 });
});

describe("A082 full item creation eligibility",()=>{
 it("requires both inventory module and enabled Items",async()=>{
  m.auth.mockResolvedValue(actor("ACCOUNT_ADMIN"));customModels.accountSettings.findUnique.mockResolvedValue({enabledModules:["INVENTORY"],itemSettings:{enabled:true}} as never);
  expect((await quotationEditorOptions()).canCreateItem).toBe(true);
  customModels.accountSettings.findUnique.mockResolvedValue({enabledModules:[],itemSettings:{enabled:true}} as never);expect((await quotationEditorOptions()).canCreateItem).toBe(false);
  customModels.accountSettings.findUnique.mockResolvedValue({enabledModules:["INVENTORY"],itemSettings:{enabled:false}} as never);expect((await quotationEditorOptions()).canCreateItem).toBe(false);
 });
 it("does not grant item creation to a quotation-only or data-entry role",async()=>{
  customModels.accountSettings.findUnique.mockResolvedValue({enabledModules:["INVENTORY"],itemSettings:{enabled:true}} as never);
  for(const role of ["PROJECT_MANAGER","DATA_ENTRY"] as const){m.auth.mockResolvedValue(actor(role));expect((await quotationEditorOptions()).canCreateItem).toBe(false)}
 });
});

 it("projects only company-scoped public display preferences and never exposes other settings",async()=>{
  customModels.accountSettings.findUnique.mockResolvedValueOnce({appLanguage:"en",baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY",transactionDefaults:{private:"SECRET"}} as never);
  m.shareFind.mockResolvedValue({companyId:C,revisionId:R,revision:{revisionNumber:0,customerName:"Acme",document:{documentType:"QUOTATION",documentNumber:"Q-1",company:{name:"Safe"},branch:{name:"Main"}},lines:[],adjustments:[],paymentSchedule:[]}});
  const result=await getPublicQuotation("token");
  expect(customModels.accountSettings.findUnique).toHaveBeenCalledWith({where:{companyId:C},select:{appLanguage:true,baseCurrency:true,displayDecimalPlaces:true,dateFormat:true}});
  expect(result.displayPreferences).toEqual({appLanguage:"en",baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"});
  expect(JSON.stringify(result)).not.toMatch(/SECRET|transactionDefaults|companyId|revisionId/);
 });

 it("validates explicit quotation supply context while allowing omitted and cleared legacy values",async()=>{
  const {quotationInput}=await import("./service");
  for(const code of ["29","27","38"])expect(quotationInput.parse(input({stateOfSupplyCode:code})).stateOfSupplyCode).toBe(code);
  expect(quotationInput.parse(input()).stateOfSupplyCode).toBeUndefined();expect(quotationInput.parse(input({stateOfSupplyCode:null})).stateOfSupplyCode).toBeNull();
  for(const code of ["","99","2","Karnataka",29])expect(quotationInput.safeParse(input({stateOfSupplyCode:code})).success).toBe(false);
 });

it("validates, trims and explicitly clears billing names without changing customer identity",async()=>{
 await createQuotation(input({billingName:"  Site division  "}));
 expect(m.revisionCreate).toHaveBeenLastCalledWith({data:expect.objectContaining({billingName:"Site division",customerName:"Acme"})});
 m.docFind.mockResolvedValue({id:ID,companyId:C,branchId:B,documentType:"QUOTATION",customerId:ID,sourceLeadId:null,status:"DRAFT",revisions:[{...revision(),billingName:"Existing division"}]});
 await updateQuotationDraft(ID,input());expect(m.revisionCreate).toHaveBeenLastCalledWith({data:expect.objectContaining({billingName:"Existing division"})});
 await updateQuotationDraft(ID,input({billingName:"   "}));expect(m.revisionCreate).toHaveBeenLastCalledWith({data:expect.objectContaining({billingName:null})});
 await expect(createQuotation(input({billingName:"x".repeat(241)}))).rejects.toThrow();
});

it("shows only the authenticated company as the editor firm and ignores a forged company on save",async()=>{
 m.company.mockResolvedValue({name:"Authorized company",productEdition:"SALESPUNCH360_ACCOUNT"});
 expect((await quotationEditorOptions()).companyName).toBe("Authorized company");
 expect(m.company).toHaveBeenLastCalledWith({where:{id:C},select:{productEdition:true,name:true}});
 await createQuotation(input({companyId:"foreign-company",companyName:"Forged firm"}));
 expect(m.docCreate).toHaveBeenLastCalledWith({data:expect.objectContaining({companyId:C})});
 expect(m.revisionCreate.mock.calls.at(-1)?.[0].data).not.toHaveProperty("companyName");
});
