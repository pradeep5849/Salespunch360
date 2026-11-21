import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
/** Readiness follows the same canonical catalogue used to initialize Account companies. */
export function missingCanonicalLedgerKeys(existing: readonly { systemKey: string | null }[]): string[] {
  const found = new Set(existing.map(x => x.systemKey));
  return DEFAULT_LEDGER_ACCOUNTS.flatMap(x => typeof x.systemKey === "string" && !found.has(x.systemKey) ? [x.systemKey] : []);
}
