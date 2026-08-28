import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

export function normalizeCompanySlug(value: string) {
  return value.trim().toLowerCase();
}

export const registrationSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companySlug: z.string().transform(normalizeCompanySlug).pipe(
    z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens only").min(2).max(63),
  ),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(12).max(200)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  confirmPassword: z.string().min(1).max(200),
}).strict().superRefine((data, context) => {
  if (data.adminPassword !== data.confirmPassword) {
    context.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
  }
});

export type RegistrationInput = z.input<typeof registrationSchema>;
