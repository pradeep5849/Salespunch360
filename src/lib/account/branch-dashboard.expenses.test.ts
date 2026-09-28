import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { dashboardExpenseSummary } from "./branch-dashboard";

const D=(value:number)=>new Prisma.Decimal(value);

describe("dashboard monthly expense summary",()=>{
  it("keeps the full total when the display breakdown is limited to five categories",()=>{
    const all=[100,90,80,70,60,50].map((amount,index)=>({categoryId:`category-${index+1}`,amount:D(amount)}));
    const names=new Map(all.map((row,index)=>[row.categoryId,`Category ${index+1}`]));
    const result=dashboardExpenseSummary(all.reduce((total,row)=>total.add(row.amount),D(0)),all,names);
    expect(result.currentMonthExpenses.toString()).toBe("450");
    expect(result.expenseBreakdown).toHaveLength(5);
    expect(result.expenseBreakdown.map(row=>row.amount.toString())).toEqual(["100","90","80","70","60"]);
  });
});
