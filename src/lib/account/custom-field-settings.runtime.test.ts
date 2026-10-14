import {beforeEach,describe,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({find:vi.fn(),count:vi.fn(),update:vi.fn(),create:vi.fn(),audit:vi.fn(),lock:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({AuthorizationError:class extends Error{}}));
vi.mock("@/lib/db",()=>({db:{$transaction:async(fn:(tx:Record<string,unknown>)=>unknown)=>fn({$executeRaw:m.lock,customFieldDefinition:{findFirst:m.find,update:m.update,create:m.create},customFieldValue:{count:m.count},accountingAuditEvent:{create:m.audit}})}}));
import {saveCustomFieldForActor} from "./settings";
const actor={id:"admin",companyId:"company",accountRole:"ACCOUNT_ADMIN"};
const input={id:"00000000-0000-4000-8000-000000000001",entityType:"CUSTOMER",fieldKey:"reference",label:"Customer reference",dataType:"TEXT",isRequired:false,position:0};
beforeEach(()=>{vi.clearAllMocks();m.find.mockResolvedValue(input);m.count.mockResolvedValue(1);m.update.mockResolvedValue(input);m.create.mockResolvedValue(input)});
describe("A089 custom field management",()=>{
 it("retains stored values while deactivating a definition",async()=>{await saveCustomFieldForActor(actor,{...input,isActive:false});expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({isActive:false})}));expect(m.audit).toHaveBeenCalled()});
 it("does not allow a used field type to change",async()=>{await expect(saveCustomFieldForActor(actor,{...input,dataType:"NUMBER"})).rejects.toThrow("USED_CUSTOM_FIELD_TYPE_LOCKED");expect(m.update).not.toHaveBeenCalled()});
 it("rejects an inaccessible definition ID",async()=>{m.find.mockResolvedValue(null);await expect(saveCustomFieldForActor(actor,input)).rejects.toThrow("CUSTOM_FIELD_NOT_FOUND");expect(m.find.mock.calls[0][0].where).toMatchObject({companyId:"company"});expect(m.update).not.toHaveBeenCalled()});
 it("updates print visibility while preserving existing validation metadata",async()=>{m.find.mockResolvedValue({...input,validation:{dateFormat:"DD/MM/YYYY",showInPrint:true}});await saveCustomFieldForActor(actor,{...input,showInPrint:false});expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({validation:{dateFormat:"DD/MM/YYYY",showInPrint:false}})}))});
 it("requires select choices and account administration",async()=>{await expect(saveCustomFieldForActor(actor,{...input,dataType:"SELECT",options:[]})).rejects.toThrow("SELECT_OPTIONS_REQUIRED");await expect(saveCustomFieldForActor({...actor,accountRole:"DATA_ENTRY"},input)).rejects.toThrow();expect(m.update).not.toHaveBeenCalled()});
});

it.each(["PRODUCT","SERVICE","WORK_PACKAGE","PROJECT","ASSET"])("rejects unsupported %s print visibility before writes",async entityType=>{await expect(saveCustomFieldForActor(actor,{...input,entityType,showInPrint:true})).rejects.toThrow("CUSTOM_FIELD_PRINT_UNSUPPORTED");expect(m.update).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()});
it.each(["CUSTOMER","VENDOR","QUOTATION","SALES_INVOICE","PURCHASE_BILL"])("retains supported %s print configuration",async entityType=>{m.find.mockResolvedValue({...input,entityType});await saveCustomFieldForActor(actor,{...input,entityType,showInPrint:true});expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({validation:{showInPrint:true}})}))});
it("allows an explicit save to clear legacy unsupported print metadata without losing values",async()=>{m.find.mockResolvedValue({...input,entityType:"PRODUCT",validation:{showInPrint:true,retained:"metadata"}});await saveCustomFieldForActor(actor,{...input,entityType:"PRODUCT",showInPrint:false});expect(m.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({validation:{showInPrint:false,retained:"metadata"}})}))});
