import {describe,it,expect} from "vitest";
import {QuotationStatus} from "@prisma/client";
import {quotationListFilter,OPEN_QUOTATION_STATUSES,CLOSED_QUOTATION_STATUSES} from "./list-filter";
describe("estimate list lifecycle groups",()=>{
 it("maps every retained lifecycle state to exactly one group",()=>{expect([...OPEN_QUOTATION_STATUSES,...CLOSED_QUOTATION_STATUSES].sort()).toEqual(Object.values(QuotationStatus).sort());expect(new Set([...OPEN_QUOTATION_STATUSES,...CLOSED_QUOTATION_STATUSES]).size).toBe(9);expect(CLOSED_QUOTATION_STATUSES).toContain("ACCEPTED");expect(quotationListFilter({status:"OPEN"}).where.status).toEqual({in:OPEN_QUOTATION_STATUSES});});
 it("uses bounded server search for number and customer while preserving explicit old statuses",()=>{expect(quotationListFilter({q:" Customer ",status:"SENT",offset:"50",limit:51})).toMatchObject({query:{q:"Customer",offset:50,limit:51},where:{status:"SENT",OR:[{documentNumber:{contains:"Customer",mode:"insensitive"}},{revisions:{some:{customerName:{contains:"Customer",mode:"insensitive"}}}}]}});});
 it("rejects unexpected company/scope injection, invalid groups and unbounded pages",()=>{for(const raw of [{companyId:"forged"},{status:"POSTED"},{limit:202},{offset:-1},{q:"x".repeat(161)}])expect(()=>quotationListFilter(raw)).toThrow();});
});

 it("excludes converted sources from Open and combines Closed/search scopes without losing either OR",()=>{
  expect(quotationListFilter({status:"OPEN"}).where.convertedAt).toBeNull();
  expect(quotationListFilter({status:"CLOSED"}).where.OR).toContainEqual({convertedAt:{not:null}});
  expect(quotationListFilter({status:"CLOSED",q:"party"}).where.AND).toHaveLength(2);
 });
