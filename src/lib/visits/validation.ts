import { z } from "zod";
import { coordinateSchema } from "@/lib/attendance/validation";

const requiredGps = coordinateSchema.extend({ accuracyMeters: z.number().finite().min(0).max(10_000) });
const optionalNotes = z.preprocess((value) => typeof value === "string" && value.trim() === "" ? undefined : value, z.string().trim().max(2000).optional());

export const checkInSchema = z.object({ customerId: z.string().uuid(), location: requiredGps, visitNotes: optionalNotes }).strict();
const phone = z.preprocess(v=>typeof v==="string"&&v.trim()===""?undefined:v,z.string().trim().min(7).max(30).optional());
export const fieldCheckInSchema=z.discriminatedUnion("visitType",[
 z.object({visitType:z.literal("NEW"),name:z.string().trim().min(2).max(160),phone,location:requiredGps,visitNotes:optionalNotes}).strict(),
 z.object({visitType:z.literal("FOLLOW_UP"),leadId:z.string().uuid(),followUpTaskId:z.string().uuid().optional(),location:requiredGps,visitNotes:optionalNotes}).strict(),
 z.object({visitType:z.literal("CUSTOMER"),customerId:z.string().uuid(),location:requiredGps,visitNotes:optionalNotes}).strict(),
]);
export const checkoutSchema = z.object({ visitId: z.string().uuid(), location: requiredGps, sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]), remarks: optionalNotes }).strict();
export type CheckInInput = z.input<typeof checkInSchema>;
export type CheckoutInput = z.input<typeof checkoutSchema>;
