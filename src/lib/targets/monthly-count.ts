export function monthlyTargetCount(value:number){
 if(!Number.isSafeInteger(value)||value<0)throw new Error('INVALID_TARGET');
 return value;
}
