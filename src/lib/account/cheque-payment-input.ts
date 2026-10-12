import { z } from "zod";

// Validate paper-cheque details before creating or posting the invoice.
export const chequePaymentDetails = z.object({
  chequeNumber: z.string().trim().min(1).max(80),
  chequeDate: z.string().date(),
});
