import {describe,it,expect} from "vitest";
import {quotationPrintPresentation,quotationPdfTheme} from "./print-presentation";
describe("safe quotation print presentation",()=>{
 it("projects only supported company print choices",()=>{
  expect(quotationPrintPresentation({invoicePrintSettings:{theme:"#aBc123",amountWordsFormat:"INTERNATIONAL",bankAccountId:"private",signatureObjectKey:"secret"},private:"hidden"})).toEqual({theme:"#ABC123",amountWordsFormat:"INTERNATIONAL"});
 });
 it.each([null,[],{invoicePrintSettings:"broken"},{invoicePrintSettings:{theme:"url(https://example.test)",amountWordsFormat:"unsupported"}}])("uses safe defaults for malformed historical input",input=>expect(quotationPrintPresentation(input)).toEqual({theme:"REGULAR",amountWordsFormat:"INDIAN"}));
 it("applies supported named layouts and explicit accent colors",()=>{
  expect(quotationPdfTheme({theme:"MODERN",amountWordsFormat:"INDIAN"})).toMatchObject({color:"#0f766e",ruleWidth:3});
  expect(quotationPdfTheme({theme:"MINIMAL",amountWordsFormat:"INDIAN"})).toMatchObject({margin:48,titleSize:11});
  expect(quotationPdfTheme({theme:"#aBc123",amountWordsFormat:"INDIAN"}).color).toBe("#ABC123");
 });
});

it("keeps layout and accent independent without exposing raw settings",()=>{expect(quotationPrintPresentation({quotationPrintTheme:{theme:"GST_6",color:"#abc123"},invoicePrintSettings:{theme:"CLASSIC",amountWordsFormat:"INTERNATIONAL",bankAccountId:"private"}})).toEqual({theme:"GST_6",color:"#ABC123",amountWordsFormat:"INTERNATIONAL"});expect(quotationPdfTheme({theme:"LANDSCAPE_1",color:"#998BDF",amountWordsFormat:"INDIAN"}).profile?.id).toBe("LANDSCAPE_1")});
