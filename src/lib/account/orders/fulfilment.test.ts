import {describe,it,expect} from "vitest";
import {orderQuantitySummary as summary,type OrderFulfilmentDocument} from "./fulfilment";
const order=[{id:"a",quantity:"10"},{id:"b",quantity:"2"}];
const posted=(id:string,line:string,quantity:string):OrderFulfilmentDocument=>({id,status:"POSTED",lines:[{sourceOrderLineId:line,quantity}]});
describe("order quantity lifecycle",()=>{
 it("requires every source line, even when another line is fully invoiced",()=>{expect(summary(order,[posted("1","a","10")])).toMatchObject({status:"OPEN",reason:"REMAINING",lines:[{id:"a",remaining:"0.0000"},{id:"b",remaining:"2.0000"}]})});
 it("closes only when quantities across all posted partial invoices are fulfilled",()=>{expect(summary(order,[posted("1","a","3"),posted("2","a","7"),posted("3","b","2")])).toMatchObject({status:"CLOSED",reason:"FULFILLED"})});
 it("uses primary quantity for secondary units without adding unlike units",()=>{const result=summary([{id:"a",quantity:"1",baseQuantity:"10"}],[{id:"1",status:"POSTED",lines:[{sourceOrderLineId:"a",quantity:"0.5",baseQuantity:"5"}]}]);expect(result.lines[0]).toEqual({id:"a",ordered:"10.0000",fulfilled:"5.0000",remaining:"5.0000"})});
 it("does not count draft cancelled or reversed invoices",()=>{for(const change of [{status:"DRAFT" as const},{status:"CANCELLED" as const},{reversed:true}])expect(summary([{id:"a",quantity:"10"}],[{...posted("1","a","10"),...change}]).status).toBe("OPEN")});
 it("reopens automatic closure after cancellation without deleting quantity history",()=>{const invoice=posted("1","a","10");expect(summary([order[0]],[invoice]).status).toBe("CLOSED");expect(summary([order[0]],[{...invoice,status:"CANCELLED"}])).toMatchObject({status:"OPEN",lines:[{fulfilled:"0.0000",remaining:"10.0000"}]})});
 it("manual closure preserves unfulfilled amounts and remains distinct from invoicing",()=>{expect(summary(order,[posted("1","a","3")],true)).toMatchObject({status:"CLOSED",reason:"MANUAL",lines:[{remaining:"7.0000"},{remaining:"2.0000"}]})});
 it("keeps duplicate items separate by source line and rejects unknown provenance",()=>{expect(summary(order,[posted("1","b","2")]).lines[0].fulfilled).toBe("0.0000");expect(()=>summary(order,[posted("1","missing","1")])).toThrow("INVALID_SOURCE_ORDER_LINE")});
 it("rejects overfulfilment on a single line regardless of remaining other quantities",()=>{expect(()=>summary(order,[posted("1","a","10.0001")])).toThrow("ORDER_QUANTITY_EXCEEDED")});
 it("retains decimal precision across partial invoices",()=>{expect(summary([{id:"a",quantity:"0.3"}],[posted("1","a","0.1"),posted("2","a","0.2")])).toMatchObject({status:"CLOSED",lines:[{remaining:"0.0000"}]})});
 it.each(["0","-1","NaN","Infinity","0.00001"])("rejects invalid quantity %s",quantity=>{expect(()=>summary([{id:"a",quantity}],[])).toThrow("INVALID_ORDER_QUANTITY");expect(()=>summary([order[0]],[posted("1","a",quantity)])).toThrow("INVALID_ORDER_QUANTITY")});
 it("rejects repeated source lines and repeated invoice IDs instead of double counting",()=>{expect(()=>summary([order[0],order[0]],[])).toThrow("DUPLICATE_ORDER_LINE");const invoice=posted("1","a","1");expect(()=>summary(order,[invoice,invoice])).toThrow("DUPLICATE_FULFILMENT_DOCUMENT")});
 it("does not close empty orders vacuously",()=>{expect(()=>summary([],[])).toThrow("ORDER_LINES_REQUIRED")});
});
