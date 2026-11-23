import {z} from "zod";
import type {VerificationResult} from "./utilities";
export type VerificationRecord={id?:string;label:string;kind:"journal"|"document"|"project"|"asset"};
const prefixes={journal:"/workspace/account/accounting/journals/",document:"/workspace/account/transactions/",project:"/workspace/account/projects/",asset:"/workspace/account/assets/"};
const areas:Record<string,string>={
 "Posted document lines and header totals reconcile":"/workspace/account/transactions",
 "Effective allocations do not exceed document payable":"/workspace/account/transactions",
 "Journal dates belong to their financial year":"/workspace/account/accounting/journals",
 "Posted journals respect the current lock boundary":"/workspace/account/accounting/journals",
 "Journal entries balance":"/workspace/account/accounting/journals",
 "Document outstanding is valid":"/workspace/account/transactions",
 "Stored tax components reconcile":"/workspace/account/transactions",
 "Canonical system-ledger readiness":"/workspace/account/accounting/accounts",
 "System ledgers are unique":"/workspace/account/accounting/accounts",
 "Money accounts map to ledgers":"/workspace/account/money/accounts",
 "Stock movements have valid positive quantities":"/workspace/account/inventory/stock",
 "Warehouse transfer legs reconcile":"/workspace/account/inventory/transfers",
 "Project tenant references are valid":"/workspace/account/projects",
 "Asset Branch references are valid":"/workspace/account/assets",
 "Asset assignment history agrees with current assignment":"/workspace/account/assets",
};
/** Callers supply only affected records from the authorized company snapshot.
 * Links open existing read workflows; those destinations independently authorize again. */
export function verificationActions(check:VerificationResult,records:readonly VerificationRecord[]=[]):VerificationResult {
 if(check.status==="PASS"||check.incomplete)return check;
 const links=records.filter((row)=>z.string().guid().safeParse(row.id).success).slice(0,5).map(row=>({label:row.label,href:prefixes[row.kind]+row.id}));
 return {...check,...(links.length?{records:links}:{}),...(areas[check.check]?{reviewHref:areas[check.check]}:{})};
}
