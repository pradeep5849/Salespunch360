import { z } from "zod";
import { strongPasswordSchema } from "@/lib/auth/validation";
import { managerTypeSchema } from "@/lib/users/validation";
import {
  employeeCodeSchema,
  employeeProfileFields,
  phoneSchema,
} from "@/lib/users/employee-profile-validation";

const normalizeOptional = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;

export { employeeCodeSchema, phoneSchema };

const passwordFields = {
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1).max(200),
};
const branchFields = {
  branchAccessScope: z.enum(["ALL_BRANCHES", "SELECTED_BRANCHES"]).prefault("ALL_BRANCHES"),
  branchIds: z.array(z.string().guid()).prefault([]),
};

const confirmPasswords = <T extends { password: string; confirmPassword: string }>(data: T, context: z.RefinementCtx) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
};

export const createManagerSchema = z.object({ ...employeeProfileFields, ...passwordFields, ...branchFields, managerType: managerTypeSchema.prefault("FIELD_MANAGER") }).strict().superRefine(confirmPasswords);

export const createSalesSchema = z.object({
  ...employeeProfileFields,
  ...passwordFields,
  ...branchFields,
  managerId: z.preprocess(normalizeOptional, z.string().guid().optional()),
}).strict().superRefine(confirmPasswords);

export const editEmployeeSchema = z.object({
  employeeId: z.string().guid(),
  ...employeeProfileFields,
  managerId: z.preprocess(normalizeOptional, z.string().guid().nullable().optional()),
  managerType: z.preprocess(normalizeOptional, managerTypeSchema.optional()),
}).strict();

export const employeeIdSchema = z.object({ employeeId: z.string().guid() }).strict();
export const changeSalesRoleSchema=z.object({employeeId:z.string().guid(),role:z.enum(["ADDITIONAL_ADMIN","SALES_MANAGER","OFFICE_MANAGER","SALES_EMPLOYEE"]),managerId:z.preprocess(normalizeOptional,z.string().guid().nullable().optional())}).strict();

export const resetEmployeePasswordSchema = z.object({
  employeeId: z.string().guid(),
  ...passwordFields,
}).strict().superRefine(confirmPasswords);

export type CreateManagerInput = z.input<typeof createManagerSchema>;
export type CreateSalesInput = z.input<typeof createSalesSchema>;
export type EditEmployeeInput = z.input<typeof editEmployeeSchema>;
export type ResetEmployeePasswordInput = z.input<typeof resetEmployeePasswordSchema>;
