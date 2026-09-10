import { z } from "zod";

const optional = (max = 2000) => z.preprocess(v => typeof v === "string" && !v.trim() ? undefined : v, z.string().trim().max(max).optional());
const code = optional(60).transform(v => v?.toUpperCase());
const money = z.preprocess(v => v === "" || v == null ? undefined : v, z.coerce.number().min(0).max(9999999999999999).optional());
export const id = z.string().uuid();
export const financialYearSchema = z.object({name:z.string().trim().min(1).max(80),startDate:z.coerce.date(),endDate:z.coerce.date(),isCurrent:z.coerce.boolean().default(false)}).superRefine((v,c)=>{if(v.endDate<=v.startDate)c.addIssue({code:"custom",message:"End date must be after start date",path:["endDate"]});});
export const currencySchema=z.object({baseCurrency:z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/)});
export const unitSchema=z.object({name:z.string().trim().min(1).max(80),symbol:z.string().trim().min(1).max(20)});
export const categorySchema=z.object({name:z.string().trim().min(1).max(100),description:optional(),scope:z.enum(["PRODUCT","SERVICE","BOTH"]).default("BOTH")});
const optionalBusinessId=(pattern:RegExp,message:string)=>z.preprocess(v=>typeof v==="string"&&!v.trim()?undefined:v,z.string().trim().toUpperCase().regex(pattern,message).optional());
export const partySchema=z.object({name:z.string().trim().min(1).max(200),contactPerson:optional(160),phone:optional(30),email:z.preprocess(v=>typeof v==="string"&&!v.trim()?undefined:v,z.string().trim().email().max(320).transform(v=>v.toLowerCase()).optional()),address:optional(),shippingAddress:optional(),gstin:optionalBusinessId(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,"Enter a valid GSTIN"),pan:optionalBusinessId(/^[A-Z]{5}\d{4}[A-Z]$/,"Enter a valid PAN"),notes:optional()});
export const itemSchema=z.object({name:z.string().trim().min(1).max(200),code,categoryId:id.optional(),unitId:id.optional(),description:optional(),sellingRate:money,cost:money,taxRate:z.preprocess(v=>v===""||v==null?undefined:v,z.coerce.number().min(0).max(100).optional())});
export const workCategorySchema=z.object({name:z.string().trim().min(1).max(100),description:optional()});
export const workPackageSchema=itemSchema.extend({workCategoryId:id});
export const numberingSeriesSchema=z.object({branchId:id.optional(),seriesKey:z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,59}$/),prefix:z.string().max(30).default(""),suffix:z.string().max(30).default(""),padding:z.coerce.number().int().min(1).max(18).default(5)});
export const customFieldSchema=z.object({entityType:z.enum(["CUSTOMER","VENDOR","PRODUCT","SERVICE","WORK_PACKAGE"]),fieldKey:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,59}$/),label:z.string().trim().min(1).max(100),dataType:z.enum(["TEXT","TEXTAREA","NUMBER","DECIMAL","DATE","BOOLEAN","SELECT"]),isRequired:z.coerce.boolean().default(false),position:z.coerce.number().int().min(0).max(10000).default(0),options:z.array(z.string().max(100)).max(100).optional()});
