import { z } from "zod";
import { coordinateSchema } from "@/lib/attendance/validation";

const requiredGps = coordinateSchema.extend({ accuracyMeters: z.number().finite().min(0).max(10_000) });
const optionalNotes = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(2000).optional());

export const checkInSchema = z.object({ customerId: z.string().uuid(), location: requiredGps, visitNotes: optionalNotes }).strict();
export const checkoutSchema = z.object({ visitId: z.string().uuid(), location: requiredGps, sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]), remarks: optionalNotes }).strict();
export type CheckInInput = z.input<typeof checkInSchema>;
export type CheckoutInput = z.input<typeof checkoutSchema>;
