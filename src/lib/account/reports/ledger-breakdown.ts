import {Prisma} from "@prisma/client";
import type {ReportLine} from "../financial-reports";
const ExactDecimal=Prisma.Decimal.clone({precision:48});
export type LedgerBreakdown={title:string;total:string;rows:Array<{code:string;name:string;amount:string}>};
/** Use the same period/closing signs as the financial summaries, including contra balances. */
export function financialLedgerBreakdown(lines:ReportLine[],balanceSheet:boolean):LedgerBreakdown[]{
 const groups: Array<{title:string;classes:ReportLine["accountClass"][];credit:boolean}>=balanceSheet?[{title:"Assets",classes:["ASSET"],credit:false},{title:"Liabilities",classes:["LIABILITY"],credit:true},{title:"Equity",classes:["EQUITY"],credit:true},{title:"Current Earnings",classes:["INCOME","EXPENSE"],credit:true}]:[{title:"Income",classes:["INCOME"],credit:true},{title:"Expenses / COGS",classes:["EXPENSE"],credit:false}];
 return groups.map(group=>{const rows=lines.filter(line=>group.classes.includes(line.accountClass)).map(line=>{const debit=new ExactDecimal(line.periodDebit).add(balanceSheet?line.openingDebit:0),credit=new ExactDecimal(line.periodCredit).add(balanceSheet?line.openingCredit:0),amount=group.credit?credit.sub(debit):debit.sub(credit);return{code:line.code,name:line.name,amount:amount.toString()}}).filter(row=>!new ExactDecimal(row.amount).isZero()).sort((a,b)=>a.code.localeCompare(b.code));return{title:group.title,total:rows.reduce((sum,row)=>sum.add(row.amount),new ExactDecimal(0)).toString(),rows}});
}
