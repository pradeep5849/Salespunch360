import {describe,it,expect} from "vitest";
import {Prisma} from "@prisma/client";
import {sumPersistedMoney} from "./money-sum";
describe("exact persisted monetary totals",()=>{
 it("retains cents after aggregating balances larger than Decimal arithmetic precision",()=>{expect(sumPersistedMoney(Array.from({length:1000},()=>new Prisma.Decimal("9999999999999999.99")))).toBe("9999999999999999990.00");});
 it("retains corrections and signed cent balances without negative zero",()=>{expect(sumPersistedMoney([new Prisma.Decimal("0.01"),new Prisma.Decimal("-0.02")])).toBe("-0.01");expect(sumPersistedMoney([new Prisma.Decimal("0.01"),new Prisma.Decimal("-0.01")])).toBe("0.00");});
});
