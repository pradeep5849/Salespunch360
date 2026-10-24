export const MONEY_TRANSFER_MODES=["BANK_TO_CASH","CASH_TO_BANK","BANK_TO_BANK","ALL"] as const;
export type MoneyTransferMode=typeof MONEY_TRANSFER_MODES[number];
type Account={id:string;type:string};
/** Filter account choices only; posting still validates company, branch and ledger. */
export function transferModeChoices<T extends Account>(accounts:readonly T[],mode:MoneyTransferMode,side:"source"|"destination"):T[]{
 if(mode==="ALL")return [...accounts];
 const cash=(mode==="BANK_TO_CASH"&&side==="destination")||(mode==="CASH_TO_BANK"&&side==="source");
 return accounts.filter(row=>cash?row.type==="CASH"||row.type==="PETTY_CASH":row.type==="BANK");
}
