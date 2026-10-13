/** Exact minor-unit sum matching the service's nonnegative two-decimal money input. */
export function loanPaymentTotal(...amounts:string[]):string|null {
 let total=BigInt(0);
 for(const raw of amounts){const value=raw.trim()||"0";if(!/^\d{1,16}(\.\d{1,2})?$/.test(value))return null;const [whole,fraction=""]=value.split(".");total+=BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"));}
 return `${total/BigInt(100)}.${(total%BigInt(100)).toString().padStart(2,"0")}`;
}
