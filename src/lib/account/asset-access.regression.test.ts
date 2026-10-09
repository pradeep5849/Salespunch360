import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({company:vi.fn(),branch:vi.fn(),asset:vi.fn(),transaction:vi.fn(),create:vi.fn(),number:vi.fn(),audit:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{company:{findUnique:m.company},branch:{findFirst:m.branch},asset:{findFirst:m.asset},$transaction:m.transaction}}));
vi.mock("./numbering",()=>({allocateDocumentNumberInTx:m.number}));
import {assetOptionsForActor,createAssetForActor,getAssetForActor,assignAssetForActor,returnAssetForActor,setAssetStatusForActor,updateAssetForActor} from "./assets";
import type {ProjectActor} from "./projects";
const branchId="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const a={id:"actor",companyId:"company",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES",branchIds:[branchId]} as ProjectActor;
const input={branchId,name:"Machine",assetType:"EQUIPMENT",purchaseValue:"100",purchaseDate:"2026-10-09"};
beforeEach(()=>{vi.clearAllMocks();m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:["ASSETS"]}});m.branch.mockResolvedValue({id:branchId});m.number.mockResolvedValue("AST-000001");m.create.mockResolvedValue({id:"asset"});m.transaction.mockImplementation(fn=>fn({asset:{create:m.create},accountOperationalAudit:{create:m.audit}}))});
const calls=(actor:ProjectActor)=>[()=>assetOptionsForActor(actor),()=>createAssetForActor(actor,input),()=>getAssetForActor(actor,"asset"),()=>updateAssetForActor(actor,"asset",input),()=>assignAssetForActor(actor,"asset","user"),()=>returnAssetForActor(actor,"asset"),()=>setAssetStatusForActor(actor,"asset","ACTIVE")];
describe("A044-F01/F03 asset service access",()=>{
 it("rejects all entry points when Assets is OFF without reading asset data or writing",async()=>{m.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:[]}});for(const call of calls(a))await expect(call()).rejects.toThrow("MODULE_DISABLED:ASSETS");expect(m.asset).not.toHaveBeenCalled();expect(m.branch).not.toHaveBeenCalled();expect(m.transaction).not.toHaveBeenCalled()});
 it.each(["DATA_ENTRY","PROJECT_MANAGER"])("rejects %s on every service operation",async role=>{for(const call of calls({...a,accountRole:role} as ProjectActor))await expect(call()).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled()});
 it.each(["ACCOUNT_ADMIN","ACCOUNTANT"])("allows %s creation in the exact authorized active branch",async role=>{await createAssetForActor({...a,accountRole:role} as ProjectActor,input);expect(m.branch).toHaveBeenCalledWith({where:{id:branchId,companyId:"company",isActive:true}});expect(m.create).toHaveBeenCalled()});
 it("rejects a submitted unauthorized branch before allocating a number",async()=>{await expect(createAssetForActor(a,{...input,branchId:other})).rejects.toThrow();expect(m.branch).not.toHaveBeenCalled();expect(m.number).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled()});
 it("rejects inactive/foreign-company branches without writes",async()=>{m.branch.mockResolvedValue(null);await expect(createAssetForActor(a,input)).rejects.toThrow();expect(m.create).not.toHaveBeenCalled();expect(m.number).not.toHaveBeenCalled()});
 it("scopes detail lookup by company and authorized branches",async()=>{m.asset.mockResolvedValue(null);await expect(getAssetForActor(a,"foreign")).rejects.toThrow();expect(m.asset).toHaveBeenCalledWith({where:{id:"foreign",companyId:"company",branchId:{in:[branchId]}}})});
});
