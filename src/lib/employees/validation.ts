import { z } from "zod";
import { strongPasswordSchema } from "@/lib/auth/validation";

const normalizeOptional = (value: unknown) => typeof value === "string" && value.trim() === "" ? undefined : value;

export const employeeCodeSchema = z.preprocess(
  normalizeOptional,
  z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,31}$/, "Use letters, numbers, and hyphens only").optional(),
);

export const phoneSchema = z.preprocess(
  normalizeOptional,
  z.string().transform((value) => value.replace(/[\s().-]/g, "")).pipe(
    z.string().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number"),
  ).optional(),
);

const profileFields = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  employeeCode: employeeCodeSchema,
};

const passwordFields = {
  password: strongPasswordSchema,
  confirmPassword: z.string().min(1).max(200),
};

const confirmPasswords = <T extends { password: string; confirmPassword: string }>(data: T, context: z.RefinementCtx) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
};

export const createManagerSchema = z.object({ ...profileFields, ...passwordFields }).strict().superRefine(confirmPasswords);

export const createSalesSchema = z.object({
  ...profileFields,
  ...passwordFields,
  managerId: z.preprocess(normalizeOptional, z.string().uuid().optional()),
}).strict().superRefine(confirmPasswords);

export const editEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  ...profileFields,
  managerId: z.preprocess(normalizeOptional, z.string().uuid().nullable().optional()),
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
