import { z } from "zod";
import { phoneSchema } from "@/lib/employees/validation";

const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(max).optional());

export const customerFields = {
  name: z.string().trim().min(2).max(160), contactPerson: optionalText(120), phone: phoneSchema,
  email: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().email().transform((value) => value.toLowerCase()).optional()),
};
export const assignCustomerSchema=z.object({customerId:z.string().guid(),assignedUserId:z.string().guid()}).strict();

export const createCustomerSchema = z.object({name:customerFields.name,phone:phoneSchema.nonoptional({error:"Phone number is required"}),assignedUserId:z.preprocess((value)=>value===""||value===null?undefined:value,z.string().guid().optional()),branchId:z.preprocess(value=>value===""||value===null?undefined:value,z.string().guid().optional())}).strict();
export const editCustomerSchema = z.object({ customerId: z.string().guid(), ...customerFields }).strict();
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type EditCustomerInput = z.input<typeof editCustomerSchema>;
