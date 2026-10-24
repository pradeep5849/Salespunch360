import { z } from "zod";
export const adminOrderQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).prefault(1),
  q: z.string().trim().max(160).prefault(""),
  pending: z.boolean().prefault(false),
});
export const ADMIN_ORDER_PAGE_SIZE = 50;
