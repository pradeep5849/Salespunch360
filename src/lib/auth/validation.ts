import { z } from "zod";

export const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const strongPasswordSchema = z.string().min(12).max(200)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

export const productEditionSchema = z.enum(["SALESPUNCH360", "SALESPUNCH360_ACCOUNT", "SALESPUNCH360_PLUS"]);
export const publicProductEditionSchema = productEditionSchema;

export const registrationSchema = z.object({
  productEdition: publicProductEditionSchema,
  companyName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: emailSchema,
  adminPassword: strongPasswordSchema,
  confirmPassword: z.string().min(1).max(200),
}).strict().superRefine((data, context) => {
  if (data.adminPassword !== data.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
});

export type RegistrationInput = z.input<typeof registrationSchema>;
