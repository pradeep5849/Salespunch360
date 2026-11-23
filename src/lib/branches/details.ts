import { z } from "zod";
const optional = (n: number) =>
  z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(n).nullable().optional(),
  );
export const branchDetails = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z.string().trim().toUpperCase().min(1).max(20),
    addressLine1: optional(200),
    city: optional(120),
    state: optional(120),
    postalCode: optional(20),
    country: optional(120),
    phone: optional(30),
    email: z.preprocess(
      (v) => (v === "" ? null : v),
      z.string().trim().email().nullable().optional(),
    ),
  })
  .strict();
