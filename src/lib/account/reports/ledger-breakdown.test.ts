import {Prisma} from "@prisma/client";
import {it,expect} from "vitest";
import {financialLedgerBreakdown} from "./ledger-breakdown";
import {profitAndLoss,balanceSheet,trialBalance,runningLedger,type ReportLine} from "../financial-reports";
import {formatReport} from "./display";
import {reportExportRows} from "./export-data";
import {resolveDisplayPreferences} from "../display-preferences";
const D=Prisma.Decimal;
const row=(code:string,accountClass:ReportLine['accountClass'],debit:string,credit:string,openingDebit="0",openingCredit="0"):ReportLine=>({ledgerId:code,code,name:`Ledger ${code}`,accountClass,openingDebit:new D(openingDebit),openingCredit:new D(openingCredit),periodDebit:new D(debit),periodCredit:new D(credit)});
const lines=[row("100","ASSET","500","0","100"),row("200","LIABILITY","0","50"),row("300","EQUITY","0","100","0","100"),row("400","INCOME","0","300"),row("401","INCOME","20","0"),row("500","EXPENSE","50","0"),row("501","EXPENSE","0","5")];
it("matches P&L period totals with contra income/expense and excludes opening balances",()=>{const p=profitAndLoss(lines),b=financialLedgerBreakdown(lines,false);expect(b.map(x=>x.total)).toEqual([p.income.toString(),p.expenses.toString()]);expect(b[0].rows.map(x=>x.amount)).toEqual(["300","-20"]);expect(b[1].rows.map(x=>x.amount)).toEqual(["50","-5"])});
it("matches each Balance Sheet closing section including earnings and keeps every source immutable",()=>{const before=JSON.stringify(lines),b=balanceSheet(lines);expect(financialLedgerBreakdown(lines,true).map(x=>x.total)).toEqual([b.assets,b.liabilities,b.equity,b.currentEarnings].map(x=>x.toString()));expect(JSON.stringify(lines)).toBe(before)});
it("keeps empty/zero groups and exact large cents through display and exports",()=>{const breakdown=financialLedgerBreakdown([row("100","ASSET","90071992547409.91","0")],true);const formatted=formatReport({title:"Balance Sheet",columns:["Section","Amount"],rows:[],breakdown},resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3}),true);expect(formatted.breakdown?.[0].rows[0].amount).toBe("90071992547409.910");expect(formatted.breakdown?.[1].rows).toEqual([]);expect(reportExportRows(formatted,"scope=all")).toContainEqual(["100 Ledger 100","90071992547409.910"]);expect(breakdown[0].rows[0].amount).toBe("90071992547409.91")});

it("retains large-cent aggregates beyond the default Decimal precision in summaries and groups",()=>{const large=[row("400","INCOME","0","900719925474099999.91"),row("401","INCOME","0","900719925474099999.91")];expect(profitAndLoss(large).income.toString()).toBe("1801439850948199999.82");expect(financialLedgerBreakdown(large,false)[0].total).toBe("1801439850948199999.82");expect(balanceSheet(large).currentEarnings.toString()).toBe("1801439850948199999.82");expect(financialLedgerBreakdown(large,true)[3].total).toBe("1801439850948199999.82")});

it("retains large closing and running ledger cents",()=>{const item=row("100","ASSET","900719925474099999.91","0","900719925474099999.91");expect(trialBalance([item]).rows[0].closingDebit.toString()).toBe("1801439850948199999.82");expect(runningLedger(new D("900719925474099999.91"),[{debit:new D("900719925474099999.91"),credit:new D("0")}])[0].runningBalance.toString()).toBe("1801439850948199999.82")});
