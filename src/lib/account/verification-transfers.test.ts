import { expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { mismatchedTransferSources } from "./verification-transfers";
const row = (movementType: string, quantity: number, productId="p", warehouseId=movementType==="TRANSFER_IN"?"dest":"source") => ({id:crypto.randomUUID(),sourceId:"transfer",movementType,quantity:new Prisma.Decimal(quantity),productId,warehouseId});
it("accepts balanced multi-product and split transfer legs",()=>expect(mismatchedTransferSources([row("TRANSFER_IN",2),row("TRANSFER_OUT",1),row("TRANSFER_OUT",1),row("TRANSFER_IN",3,"q"),row("TRANSFER_OUT",3,"q")])).toEqual([]));
it("rejects the prior false pass for different products and quantities",()=>expect(mismatchedTransferSources([row("TRANSFER_IN",1,"p"),row("TRANSFER_OUT",99,"q")])).toEqual(["transfer"]));
it("detects missing legs, excess duplicate quantities, and same warehouse",()=>{
 for(const rows of [[row("TRANSFER_IN",2)],[row("TRANSFER_IN",2),row("TRANSFER_OUT",2),row("TRANSFER_OUT",2)],[row("TRANSFER_IN",2,"p","same"),row("TRANSFER_OUT",2,"p","same")]])expect(mismatchedTransferSources(rows)).toEqual(["transfer"]);
});
it("ignores ordinary movements and rejects nonpositive transfer quantities",()=>{expect(mismatchedTransferSources([row("OPENING",1)])).toEqual([]);expect(mismatchedTransferSources([row("TRANSFER_IN",0),row("TRANSFER_OUT",0)])).toEqual(["transfer"])});
