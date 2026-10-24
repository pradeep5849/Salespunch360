import { z } from "zod";
// Date-only strings must describe a real calendar date; Date callers remain supported.
const optionalCalendarDate = z.union([
  z.string().date().transform(value => new Date(`${value}T00:00:00.000Z`)),
  z.date(),
]).optional();
export const inventoryBatchInput = z.object({
  productId: z.string().guid(),
  batchNumber: z.string().trim().min(1).max(100),
  manufacturedDate: optionalCalendarDate,
  expiryDate: optionalCalendarDate,
}).strict();
export const inventorySerialInput = z.object({
  productId: z.string().guid(),
  serialNumber: z.string().trim().min(1).max(160),
  expiryDate: optionalCalendarDate,
}).strict();
