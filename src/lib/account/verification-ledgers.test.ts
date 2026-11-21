import { expect, it } from "vitest";
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { missingCanonicalLedgerKeys } from "./verification-ledgers";
it("reports missing readiness keys even when existing-key uniqueness vacuously passes",()=>{expect(missingCanonicalLedgerKeys([])).toContain("CASH");expect(missingCanonicalLedgerKeys([]).length).toBe(DEFAULT_LEDGER_ACCOUNTS.length)});
it("accepts the canonical initialization catalogue without inventing module-specific keys",()=>{expect(missingCanonicalLedgerKeys(DEFAULT_LEDGER_ACCOUNTS.map(x=>({systemKey:String(x.systemKey)})))).toEqual([])});
it("does not mistake a custom or duplicate existing key for a missing canonical key",()=>{const keys=DEFAULT_LEDGER_ACCOUNTS.filter(x=>x.systemKey!=="BANK").map(x=>({systemKey:String(x.systemKey)}));expect(missingCanonicalLedgerKeys([...keys,{systemKey:"CASH"},{systemKey:"CUSTOM"},{systemKey:null}])).toEqual(["BANK"])});
