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

const confirmPasswords = <T extends { password: string; confirmPassword: string }>(data: T, context: z.RefinementCtx) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
};

export const createManagerSchema = z.object({ ...employeeProfileFields, ...passwordFields, managerType: managerTypeSchema.default("FIELD_MANAGER") }).strict().superRefine(confirmPasswords);

export const createSalesSchema = z.object({
  ...employeeProfileFields,
  ...passwordFields,
  managerId: z.preprocess(normalizeOptional, z.string().uuid().optional()),
}).strict().superRefine(confirmPasswords);

export const editEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  ...employeeProfileFields,
  managerId: z.preprocess(normalizeOptional, z.string().uuid().nullable().optional()),
  managerType: z.preprocess(normalizeOptional, managerTypeSchema.optional()),
}).strict();

export const employeeIdSchema = z.object({ employeeId: z.string().uuid() }).strict();

export const resetEmployeePasswordSchema = z.object({
  employeeId: z.string().uuid(),
  ...passwordFields,
}).strict().superRefine(confirmPasswords);

export type CreateManagerInput = z.input<typeof createManagerSchema>;
export type CreateSalesInput = z.input<typeof createSalesSchema>;
export type EditEmployeeInput = z.input<typeof editEmployeeSchema>;
export type ResetEmployeePasswordInput = z.input<typeof resetEmployeePasswordSchema>;
