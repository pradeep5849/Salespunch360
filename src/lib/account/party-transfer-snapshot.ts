import {z} from "zod";
import {partyTransferBaseInput} from "./party-transfer-policy";
export const partyTransferSnapshot=partyTransferBaseInput.omit({requestKey:true}).extend({
 version:z.literal(1),requestHash:z.string().regex(/^[a-f0-9]{64}$/),number:z.string().min(1).max(100),
 receivedPartyName:z.string(),paidPartyName:z.string(),passThroughAmount:z.string(),commissionAmount:z.string(),commissionHead:z.literal("OTHER_INCOME"),expenseAmount:z.literal("0.00"),
 photoObjectKey:z.string().nullable().default(null),photoSha256:z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),photoMimeType:z.literal("image/webp").nullable().default(null),
 passReceiptJournalId:z.string().uuid().nullable(),passPaymentJournalId:z.string().uuid().nullable(),commissionIncomeId:z.string().uuid().nullable(),
}).strict();
