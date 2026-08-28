import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

export const registrationSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companySlug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(63),
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().email().transform((value) => value.toLowerCase()),
  adminPassword: z.string().min(12).max(200)
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
}).strict();

export type RegistrationInput = z.input<typeof registrationSchema>;
