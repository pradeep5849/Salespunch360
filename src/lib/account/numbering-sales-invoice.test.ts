import {describe,expect,it,vi} from "vitest";
import {allocateDocumentNumberInTx,SALES_INVOICE_NUMBERING_DEFAULTS} from "./numbering";

describe("canonical sales invoice numbering",()=>{
 it("defines the fresh series as 01",()=>expect(`${SALES_INVOICE_NUMBERING_DEFAULTS.prefix}${String(1).padStart(SALES_INVOICE_NUMBERING_DEFAULTS.padding,"0")}${SALES_INVOICE_NUMBERING_DEFAULTS.suffix}`).toBe("01"));
 it("allocates successive values while preserving stored formatting",async()=>{
  const upsert=vi.fn().mockResolvedValue({id:"series"});
  const query=vi.fn().mockResolvedValueOnce([{prefix:"",suffix:"",padding:2,allocated:BigInt(1)}]).mockResolvedValueOnce([{prefix:"",suffix:"",padding:2,allocated:BigInt(2)}]).mockResolvedValueOnce([{prefix:"INV-",suffix:"-A",padding:6,allocated:BigInt(42)}]);
  const tx={numberingSeries:{upsert},$queryRaw:query} as never;
  const input={companyId:"company",branchId:"branch",seriesKey:"SALES_INVOICE",defaults:SALES_INVOICE_NUMBERING_DEFAULTS};
  await expect(allocateDocumentNumberInTx(tx,input)).resolves.toBe("01");
  await expect(allocateDocumentNumberInTx(tx,input)).resolves.toBe("02");
  await expect(allocateDocumentNumberInTx(tx,input)).resolves.toBe("INV-000042-A");
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({prefix:"",suffix:"",padding:2}),update:{}}));
 });
});
