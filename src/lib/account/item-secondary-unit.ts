import {Prisma} from "@prisma/client";
import {validUnitConversionRate} from "./unit-conversion-rate";
import type {ItemSettings} from "./item-settings-policy";
/** Explicit item snapshot: one primary unit equals this many secondary units. Never infer a factor from unit names. */
export async function itemSecondaryUnitInTx(tx:Prisma.TransactionClient,companyId:string,settings:ItemSettings,input:{unitId?:string;secondaryUnitId?:string;secondaryUnitsPerBase?:string}):Promise<{secondaryUnitId?:string|null;secondaryUnitsPerBase?:Prisma.Decimal|null}>{
 const {unitId,secondaryUnitId,secondaryUnitsPerBase}=input;
 if(!secondaryUnitId&&secondaryUnitsPerBase===undefined)return {};
 if(!settings.itemUnits)throw new Error("ITEM_UNITS_DISABLED");
 if(!unitId||!secondaryUnitId||unitId===secondaryUnitId||!secondaryUnitsPerBase||!validUnitConversionRate(secondaryUnitsPerBase))throw new Error("INVALID_ITEM_UNIT_CONVERSION");
 const count=await tx.accountUnit.count({where:{companyId,id:{in:[unitId,secondaryUnitId]},isActive:true}});
 if(count!==2)throw new Error("INVALID_ITEM_UNIT_CONVERSION");
 return {secondaryUnitId,secondaryUnitsPerBase:new Prisma.Decimal(secondaryUnitsPerBase)};
}
