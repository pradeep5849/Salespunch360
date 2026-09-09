import {z} from "zod";
const money=z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/).refine(value=>Number(value)>0,"Amount must be positive");
const currency=z.string().regex(/^[A-Z]{3}$/).default("INR");const uuid=z.string().uuid();const date=z.coerce.date();
export const compensationProfileSchema=z.object({employeeId:uuid,baseAmount:money,currencyCode:currency,effectiveFrom:date}).strict();
export const employeeAdvanceSchema=z.object({employeeId:uuid,branchId:uuid,amount:money,currencyCode:currency,advanceDate:date,note:z.string().trim().max(1000).optional(),reference:z.string().trim().max(120).optional()}).strict();
export const employeeReimbursementSchema=z.object({employeeId:uuid,branchId:uuid,amount:money,currencyCode:currency,requestedOn:date,description:z.string().trim().min(1).max(2000)}).strict();
export function assertEmployeeFinancialTenant(companyId:string,employee:{companyId:string|null}|null,branch:{companyId:string;isActive:boolean}|null){if(!employee||employee.companyId!==companyId||branch&&(!branch.isActive||branch.companyId!==companyId))throw new Error("NOT_FOUND")}
