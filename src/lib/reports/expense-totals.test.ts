import { describe,expect,it } from "vitest";
import { Prisma } from "@prisma/client";
import { summarizeTravelExpenses } from "./expenses";
describe("travel expense totals",()=>{
 it("sums filtered daily distances and exact decimal amounts including zero-rate days",()=>{
  expect(summarizeTravelExpenses([{distanceMeters:12345,amount:new Prisma.Decimal("30.86")},{distanceMeters:1000,amount:new Prisma.Decimal("0")},{distanceMeters:2000,amount:new Prisma.Decimal("5.01")}])).toEqual({totalDistanceKm:"15.35",totalAmount:"35.87"});
 });
 it("returns formatted zero totals for empty reports",()=>{expect(summarizeTravelExpenses([])).toEqual({totalDistanceKm:"0.00",totalAmount:"0.00"});});
});
