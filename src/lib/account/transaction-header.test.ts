import {describe,it,expect} from "vitest";
import {z} from "zod";
import {transactionHeaderFields,transactionHeaderPrintFields} from "./transaction-header";
import {Prisma} from "@prisma/client";
import {transactionRoundingLimit,defaultTransactionRoundOff} from "./transaction-rounding";

describe("transaction header snapshots",()=>{
 const schema=z.object(transactionHeaderFields).strict();
 it("validates document shipping addresses while allowing explicit clearing",()=>{
  expect(schema.parse({shippingAddress:"  Site A\nStreet 2  "}).shippingAddress).toBe("Site A\nStreet 2");
  expect(schema.parse({shippingAddress:""}).shippingAddress).toBe("");
  expect(schema.safeParse({shippingAddress:"x".repeat(5001)}).success).toBe(false);
 });
 it("keeps optional invoice metadata and validates time and statutory number",()=>{
  const data=schema.parse({billingName:" Separate billing name ",customerPoNumber:"PO-10",customerPoDate:"2026-10-10",transactionTime:"23:59",ewayBillNumber:"123456789012"});
  expect(data.billingName).toBe("Separate billing name");expect(data.customerPoDate?.toISOString()).toBe("2026-10-10T00:00:00.000Z");
  for(const value of ["24:00","12:60","13:30:60","not a time"])expect(schema.safeParse({transactionTime:value}).success).toBe(false);
  expect(schema.safeParse({ewayBillNumber:"123"}).success).toBe(false);
 });
 it("prints stored metadata using the saved date format without inventing values",()=>{
  expect(transactionHeaderPrintFields({},date=>date.toISOString())).toEqual([]);
  expect(transactionHeaderPrintFields({customerPoNumber:"PO-10",customerPoDate:new Date("2026-10-10"),transactionTime:"09:15",ewayBillNumber:"123456789012"},()=>"10/10/2026")).toEqual([{label:"Customer PO",value:"PO-10"},{label:"PO date",value:"10/10/2026"},{label:"Transaction time",value:"09:15"},{label:"E-Way Bill No.",value:"123456789012"}]);
 });
 it("supports rounding to 100 without allowing an unrestricted charge",()=>{
  const preferences={transactionPreferences:{roundOff:true,roundingStep:100}};
  expect(defaultTransactionRoundOff(new Prisma.Decimal("149.99"),preferences).toString()).toBe("-49.99");
  expect(defaultTransactionRoundOff(new Prisma.Decimal("150"),preferences).toString()).toBe("50");
  expect(defaultTransactionRoundOff(new Prisma.Decimal("149.99"),{}).toString()).toBe("0");
  expect(transactionRoundingLimit(preferences)).toBe(50);
  expect(transactionRoundingLimit({transactionPreferences:{roundOff:false,roundingStep:100}})).toBe(10);
  expect(transactionRoundingLimit({transactionPreferences:{roundOff:true,roundingStep:1000}})).toBe(10);
 });
});
