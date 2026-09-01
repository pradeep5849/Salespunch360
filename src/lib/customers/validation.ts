import { z } from "zod";
import { phoneSchema } from "@/lib/employees/validation";

const optionalText = (max: number) => z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(max).optional());
const optionalCoordinate = (min: number, max: number) => z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : Number(value), z.number().finite().min(min).max(max).optional());

export const customerFields = {
  name: z.string().trim().min(2).max(160), contactPerson: optionalText(120), phone: phoneSchema,
  email: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().email().transform((value) => value.toLowerCase()).optional()),
  address: optionalText(500), latitude: optionalCoordinate(-90, 90), longitude: optionalCoordinate(-180, 180),
};
export const assignCustomerSchema=z.object({customerId:z.string().uuid(),assignedUserId:z.string().uuid()}).strict();

const coordinatePair = (data: { latitude?: number; longitude?: number }, context: z.RefinementCtx) => {
  if ((data.latitude === undefined) !== (data.longitude === undefined)) context.addIssue({ code: "custom", path: ["latitude"], message: "Provide both latitude and longitude" });
};

export const createCustomerSchema = z.object(customerFields).strict().superRefine(coordinatePair);
export const editCustomerSchema = z.object({ customerId: z.string().uuid(), ...customerFields }).strict().superRefine(coordinatePair);
export type CreateCustomerInput = z.input<typeof createCustomerSchema>;
export type EditCustomerInput = z.input<typeof editCustomerSchema>;
