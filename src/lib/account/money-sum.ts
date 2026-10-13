import {Prisma} from "@prisma/client";
/** Sum persisted two-decimal amounts without Decimal's arithmetic precision cap. */
export function sumPersistedMoney(values:ReadonlyArray<Prisma.Decimal>):string{
 const minor=values.reduce((total,value)=>total+BigInt(value.toFixed(2).replace(".","")),BigInt(0));
 const absolute=minor<BigInt(0)?-minor:minor;
 return `${minor<BigInt(0)?"-":""}${absolute/BigInt(100)}.${(absolute%BigInt(100)).toString().padStart(2,"0")}`;
}
