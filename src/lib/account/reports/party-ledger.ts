import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sumPersistedMoney } from "../money-sum";

type LedgerEvent={kind:"OPENING"|"ENTRY";id:string|null;date:Date;source:string;reference:string;debit:Prisma.Decimal;credit:Prisma.Decimal};
/** Read posted journal history once. Allocating an advance does not pay the party twice. */
export async function partyLedgerReport(input:{companyId:string;partyId:string;customer:boolean;branches?:string[];from:Date;to:Date}) {
 const restrict=(column:Prisma.Sql)=>input.branches===undefined?Prisma.empty:input.branches.length?Prisma.sql`AND ${column} IN (${Prisma.join(input.branches.map(id=>Prisma.sql`${id}::uuid`))})`:Prisma.sql`AND FALSE`;
 const docs=input.customer?["SALES_INVOICE","CREDIT_NOTE"]:["PURCHASE_BILL","DEBIT_NOTE"],payments=input.customer?["CUSTOMER_RECEIPT","CUSTOMER_ADVANCE"]:["VENDOR_PAYMENT","VENDOR_ADVANCE"],keys=input.customer?["ACCOUNTS_RECEIVABLE","CUSTOMER_ADVANCES"]:["ACCOUNTS_PAYABLE","ADVANCES"];
 const rows=await db.$queryRaw<LedgerEvent[]>(Prisma.sql`
 WITH RECURSIVE sources AS (
   SELECT d."journalEntryId" AS id,d."documentNumber" AS reference FROM commercial_documents d
   WHERE d."companyId"=${input.companyId}::uuid AND d."partyId"=${input.partyId}::uuid AND d.type::text IN (${Prisma.join(docs)}) AND d."journalEntryId" IS NOT NULL ${restrict(Prisma.sql`d."branchId"`)}
   UNION ALL
   SELECT s."journalEntryId",s."settlementNumber" FROM account_settlements s
   WHERE s."companyId"=${input.companyId}::uuid AND s."partyId"=${input.partyId}::uuid AND s.type::text IN (${Prisma.join(payments)}) AND s."journalEntryId" IS NOT NULL ${restrict(Prisma.sql`s."branchId"`)}
   UNION ALL
   SELECT o."journalEntryId",'Opening balance' FROM party_opening_balances o
   WHERE o."companyId"=${input.companyId}::uuid AND o."partyId"=${input.partyId}::uuid AND o."partyType"=${input.customer?"CUSTOMER":"VENDOR"} ${restrict(Prisma.sql`o."branchId"`)}
 ), roots AS (SELECT id,MIN(reference) AS reference FROM sources GROUP BY id), history AS (
   SELECT j.id,r.reference,ARRAY[j.id] AS path FROM journal_entries j JOIN roots r ON r.id=j.id
   WHERE j."companyId"=${input.companyId}::uuid ${restrict(Prisma.sql`j."branchId"`)}
   UNION ALL
   SELECT j.id,h.reference,h.path||j.id FROM journal_entries j JOIN history h ON j."reversalOfId"=h.id
   WHERE j."companyId"=${input.companyId}::uuid AND NOT(j.id=ANY(h.path)) ${restrict(Prisma.sql`j."branchId"`)}
 ), events AS (
   SELECT j.id,j."entryDate" AS date,j."createdAt",j."sourceType" AS source,h.reference,SUM(l.debit) AS debit,SUM(l.credit) AS credit
   FROM history h JOIN journal_entries j ON j.id=h.id AND j."companyId"=${input.companyId}::uuid
   JOIN journal_lines l ON l."journalEntryId"=j.id AND l."companyId"=j."companyId"
   JOIN ledger_accounts a ON a.id=l."ledgerAccountId" AND a."companyId"=l."companyId"
   WHERE j.status::text IN ('POSTED','REVERSED') AND j."entryDate"<=${input.to}::date AND a."systemKey" IN (${Prisma.join(keys)})
   GROUP BY j.id,j."entryDate",j."createdAt",j."sourceType",h.reference
 ), result AS (
   SELECT 'OPENING' AS kind,NULL::uuid AS id,${input.from}::date AS date,NULL::timestamp AS "createdAt",'Opening balance' AS source,'' AS reference,COALESCE(SUM(debit),0) AS debit,COALESCE(SUM(credit),0) AS credit FROM events WHERE date<${input.from}::date
   UNION ALL
   SELECT 'ENTRY',id,date,"createdAt",source,reference,debit,credit FROM events WHERE date>=${input.from}::date
 ) SELECT kind,id,date,source,reference,debit,credit FROM result ORDER BY kind DESC,date,"createdAt",id
 `);
 const opening=rows.find(row=>row.kind==="OPENING");
 const signed=(debit:Prisma.Decimal,credit:Prisma.Decimal)=>input.customer?[debit,credit.negated()]:[credit,debit.negated()];
 let balance=sumPersistedMoney(signed(new Prisma.Decimal(opening?.debit??0),new Prisma.Decimal(opening?.credit??0)));
 const output:Array<Array<string|number>>=[[input.from.toISOString().slice(0,10),"Opening balance","","","",balance]];
 for(const row of rows.filter(row=>row.kind==="ENTRY")){
  balance=sumPersistedMoney([new Prisma.Decimal(balance),...signed(row.debit,row.credit)]);
  output.push([row.date.toISOString().slice(0,10),row.source,row.reference,row.debit.toFixed(2),row.credit.toFixed(2),balance]);
 }
 return {title:input.customer?"Customer Ledger":"Vendor Ledger",columns:["Date","Source","Reference","Debit","Credit","Balance"],rows:output,note:"Opening and running balances use posted party journals, including dated reversals. Advance allocation does not count as another payment."};
}
