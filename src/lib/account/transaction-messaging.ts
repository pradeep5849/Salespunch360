import {z} from "zod";
import {updateSettingsSectionForActor} from "./settings-persistence";
export const transactionMessagingSchema=z.object({sendToParty:z.boolean(),copyToSelf:z.boolean(),includeInvoiceLink:z.boolean()}).strict();
export function resolveTransactionMessaging(defaults:unknown){const x=(defaults??{}) as Record<string,unknown>;return transactionMessagingSchema.parse({sendToParty:false,copyToSelf:false,includeInvoiceLink:false,...((x.transactionMessaging??{}) as Record<string,unknown>)})}
export async function saveTransactionMessaging(actor:Parameters<typeof updateSettingsSectionForActor>[0],raw:unknown){return updateSettingsSectionForActor(actor,"transactionMessaging",transactionMessagingSchema.parse(raw))}
