/** Display helper only; settlement posting validates amounts independently. */
export function paymentSettlementAmount(cash:string,discount:string){
 const cents=(value:string)=>{if(!/^\d{1,16}(\.\d{1,2})?$/.test(value))return BigInt(0);const [whole,fraction=""]=value.split(".");return BigInt(whole)*BigInt(100)+BigInt(fraction.padEnd(2,"0"))};
 const total=cents(cash)+cents(discount);
 return `${total/BigInt(100)}.${String(total%BigInt(100)).padStart(2,"0")}`;
}

export function resolveInitialMoneyType(allowedTypes:readonly string[],requested?:string|null){return requested&&allowedTypes.includes(requested)?requested:allowedTypes[0]??""}
