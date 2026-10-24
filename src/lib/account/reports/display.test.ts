import { describe, expect, it } from "vitest";
import { resolveDisplayPreferences } from "../display-preferences";
import { formatReport } from "./display";

const source = {
  title: "Ledger", columns: ["Date", "Reference", "Amount", "Quantity", "Margin %"],
  rows: [["2026-10-11", "000012", "12.3456", "1.2345", "9.00"], ["", "Totals", "-0.004", "", ""]],
  totals: ["", "Totals", "12.3416", "1.2345", ""],
};
describe("report display preferences", () => {
  it("formats money and calendar dates without changing identifiers, quantities or percentages", () => {
    const result = formatReport(source, resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:3,dateFormat:"MM/DD/YYYY"}));
    expect(result.rows[0]).toEqual(["10/11/2026", "000012", "$12.346", "1.2345", "9.00"]);
    expect(result.rows[1][2]).toBe("-$0.004");
    expect(result.totals?.[2]).toBe("$12.342");
    expect(source.rows[0][2]).toBe("12.3456");
  });
  it.each([0,1,2,3,4])("uses precision %i in exports without losing raw values beforehand", precision => {
    const result = formatReport(source, resolveDisplayPreferences({baseCurrency:"AED",displayDecimalPlaces:precision}), true);
    expect(result.columns[2]).toBe("Amount (AED)");
    expect(result.rows[0][2]).toBe(["12","12.3","12.35","12.346","12.3456"][precision]);
    expect(result.rows[0][1]).toBe("000012");
    expect(result.rows[0][3]).toBe("1.2345");
    expect(result.rows[0][0]).toBe("11/10/2026");
  });
  it("preserves blank cells and text labels in monetary columns", () => {
    const result = formatReport({title:"Empty",columns:["Amount"],rows:[[""],["Not available"]]}, resolveDisplayPreferences(undefined));
    expect(result.rows).toEqual([[""],["Not available"]]);
  });
  it("preserves summary labels occupying a date column in both display and exports", () => {
    const report={title:"Withdrawals",columns:["Date","Amount"],rows:[["2026-10-11","50"]],totals:["Net withdrawals","50"]};
    for(const download of [false,true]){
      expect(formatReport(report,resolveDisplayPreferences(undefined),download).totals?.[0]).toBe("Net withdrawals");
    }
  });
});

it("preserves exact scientific aggregate cents and formats summary values without changing identifiers",()=>{
 const preferences=resolveDisplayPreferences({baseCurrency:"USD",displayDecimalPlaces:2});
 const data=formatReport({title:"Large report",columns:["Reference","Amount"],rows:[["9e15","9.00719925474099101e15"]],summary:[{label:"Total Sale",value:"9007199254740991.01",money:true},{label:"No. of Transactions",value:"2",money:false}]},preferences,true);
 expect(data.rows).toEqual([["9e15","9007199254740991.01"]]);expect(data.summary?.[0].displayValue).toBe("9007199254740991.01");expect(data.summary?.[1].displayValue).toBe("2");
});
