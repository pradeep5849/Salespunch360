import { z } from "zod";

export const transferPrimaryAdminSchema = z.object({ targetUserId: z.string().guid() }).strict();
export type TransferPrimaryAdminInput = z.infer<typeof transferPrimaryAdminSchema>;
