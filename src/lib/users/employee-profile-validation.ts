import { z } from "zod";

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const employeeCodeSchema = z.preprocess(
  blankToUndefined,
  z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{0,31}$/, "Use letters, numbers, and hyphens only").optional(),
);

export const phoneSchema = z.preprocess(
  blankToUndefined,
  z.string().transform((value) => value.replace(/[\s().-]/g, "")).pipe(
    z.string().regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number"),
  ).optional(),
);

export const designationSchema = z.preprocess(
  blankToUndefined,
  z.string().trim().max(120).optional(),
);

export const dateOfJoiningSchema = z.preprocess(blankToUndefined, z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((value, context) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) {
      context.addIssue({ code: "custom", message: "Enter a real calendar date" });
      return z.NEVER;
    }
    return date;
  }).optional());

export const employeeProfileFields = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  employeeCode: employeeCodeSchema,
  designation: designationSchema,
  dateOfJoining: dateOfJoiningSchema,
};

export const employeeProfileUpdateSchema = z.object({
  employeeId: z.string().uuid(),
  ...employeeProfileFields,
}).strict();

export function serializeEmployeeDate(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : null;
}

export type EmployeeProfileUpdateInput = z.input<typeof employeeProfileUpdateSchema>;
