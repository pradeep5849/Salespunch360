import {describe,it,expect} from "vitest";
import {transferModeChoices} from "./money-transfer-modes";
const rows=[{id:"bank",type:"BANK"},{id:"cash",type:"CASH"},{id:"petty",type:"PETTY_CASH"}];
describe("internal transfer modes",()=>{
 it("keeps cash on the appropriate side",()=>{expect(transferModeChoices(rows,"BANK_TO_CASH","source").map(x=>x.id)).toEqual(["bank"]);expect(transferModeChoices(rows,"BANK_TO_CASH","destination").map(x=>x.id)).toEqual(["cash","petty"]);expect(transferModeChoices(rows,"CASH_TO_BANK","source").map(x=>x.id)).toEqual(["cash","petty"]);expect(transferModeChoices(rows,"CASH_TO_BANK","destination").map(x=>x.id)).toEqual(["bank"])});
 it("limits both bank-to-bank sides and preserves other internal transfers",()=>{for(const side of ["source","destination"] as const)expect(transferModeChoices(rows,"BANK_TO_BANK",side).map(x=>x.id)).toEqual(["bank"]);expect(transferModeChoices(rows,"ALL","source")).toEqual(rows)});
});
