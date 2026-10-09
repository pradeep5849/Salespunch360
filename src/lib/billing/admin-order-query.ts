import { z } from "zod";
export const adminOrderQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  q: z.string().trim().max(160).default(""),
  pending: z.boolean().default(false),
});
export const ADMIN_ORDER_PAGE_SIZE = 50;
