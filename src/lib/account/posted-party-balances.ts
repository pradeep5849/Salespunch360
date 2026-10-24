import {Prisma} from "@prisma/client";
import {db} from "@/lib/db";
/** Caller supplies parties already authorized for the workspace. All values are
 * read in one database snapshot; moving funds between invoices does not create a
 * second payment. Includes dated journal reversals and historical journal-less
 * commercial documents, matching the existing single-party balance semantics. */
export async function postedPartyBalances(input:{companyId:string;partyIds:string[];customer:boolean;branches?:string[];asOf?:Date},reader:Pick<Prisma.TransactionClient,"$queryRaw">=db){
 const ids=[...new Set(input.partyIds)];
 if(ids.length>1000)throw new Error("PARTY_BALANCE_BATCH_TOO_LARGE");
 const balances=new Map(ids.map(id=>[id,new Prisma.Decimal(0)]));
 if(!ids.length||input.branches?.length===0)return balances;
 if(input.asOf&&!Number.isFinite(input.asOf.getTime()))throw new Error("INVALID_DATE");
 const restrict=(column:Prisma.Sql)=>input.branches===undefined?Prisma.empty:Prisma.sql`AND ${column} IN (${Prisma.join(input.branches.map(id=>Prisma.sql`${id}::uuid`))})`;
 const parties=Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`));
 const invoice=input.customer?"SALES_INVOICE":"PURCHASE_BILL",credit=input.customer?"CREDIT_NOTE":"DEBIT_NOTE",receipt=input.customer?"CUSTOMER_RECEIPT":"VENDOR_PAYMENT",advance=input.customer?"CUSTOMER_ADVANCE":"VENDOR_ADVANCE",keys=input.customer?["ACCOUNTS_RECEIVABLE","CUSTOMER_ADVANCES"]:["ACCOUNTS_PAYABLE","ADVANCES"];
 const rows=await reader.$queryRaw<Array<{partyId:string;balance:Prisma.Decimal}>>(Prisma.sql`
 WITH RECURSIVE source_rows AS (
 SELECT d."partyId",d."journalEntryId" FROM commercial_documents d WHERE d."companyId"=${input.companyId}::uuid AND d."partyId" IN (${parties}) AND d.type::text IN (${invoice},${credit}) AND d."journalEntryId" IS NOT NULL ${restrict(Prisma.sql`d."branchId"`)}
 UNION ALL
 SELECT s."partyId",s."journalEntryId" FROM account_settlements s WHERE s."companyId"=${input.companyId}::uuid AND s."partyId" IN (${parties}) AND s.type::text IN (${receipt},${advance}) AND s."journalEntryId" IS NOT NULL ${restrict(Prisma.sql`s."branchId"`)}
 UNION ALL
 SELECT o."partyId",o."journalEntryId" FROM party_opening_balances o WHERE o."companyId"=${input.companyId}::uuid AND o."partyId" IN (${parties}) AND o."partyType"::text=${input.customer?"CUSTOMER":"VENDOR"} ${restrict(Prisma.sql`o."branchId"`)}
 ), roots AS (SELECT DISTINCT "partyId","journalEntryId" FROM source_rows),history AS (
 SELECT r."partyId",j.id FROM roots r JOIN journal_entries j ON j.id=r."journalEntryId" AND j."companyId"=${input.companyId}::uuid WHERE j.status::text IN ('POSTED','REVERSED') ${restrict(Prisma.sql`j."branchId"`)}
 UNION
 SELECT h."partyId",j.id FROM history h JOIN journal_entries j ON j."reversalOfId"=h.id AND j."companyId"=${input.companyId}::uuid WHERE j.status::text IN ('POSTED','REVERSED') ${restrict(Prisma.sql`j."branchId"`)}
 ), amounts AS (
 SELECT h."partyId",SUM(${input.customer?Prisma.sql`l.debit-l.credit`:Prisma.sql`l.credit-l.debit`}) AS amount FROM history h JOIN journal_entries j ON j.id=h.id AND j."companyId"=${input.companyId}::uuid JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId" JOIN ledger_accounts a ON a.id=l."ledgerAccountId" AND a."companyId"=l."companyId" WHERE a."systemKey" IN (${Prisma.join(keys)}) ${input.asOf?Prisma.sql`AND j."entryDate"<=${input.asOf}::date`:Prisma.empty} GROUP BY h."partyId"
 UNION ALL
 SELECT d."partyId",SUM(CASE WHEN d.type::text=${invoice} THEN COALESCE(d."payableAmount",d."grandTotal") ELSE -COALESCE(d."payableAmount",d."grandTotal") END) FROM commercial_documents d WHERE d."companyId"=${input.companyId}::uuid AND d."partyId" IN (${parties}) AND d.status::text='POSTED' AND d."journalEntryId" IS NULL AND d.type::text IN (${invoice},${credit}) ${restrict(Prisma.sql`d."branchId"`)} ${input.asOf?Prisma.sql`AND d."issueDate"<=${input.asOf}::date`:Prisma.empty} GROUP BY d."partyId"
 ) SELECT "partyId",COALESCE(SUM(amount),0) AS balance FROM amounts GROUP BY "partyId"
 `);
 for(const row of rows){if(!balances.has(row.partyId))throw new Error("PARTY_BALANCE_SCOPE_MISMATCH");balances.set(row.partyId,new Prisma.Decimal(row.balance))}
 return balances;
}
