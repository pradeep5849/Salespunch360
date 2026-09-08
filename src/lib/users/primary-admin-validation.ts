import { z } from "zod";

export const transferPrimaryAdminSchema = z.object({ targetUserId: z.string().uuid() }).strict();
export type TransferPrimaryAdminInput = z.infer<typeof transferPrimaryAdminSchema>;
