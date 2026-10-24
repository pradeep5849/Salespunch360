import {z} from "zod";
import {quantityInBaseUnits,type ItemUnitSelection} from "./unit-quantities";
import {validUnitConversionRate} from "./unit-conversion-rate";
const snapshotSchema=z.object({version:z.literal(1),selection:z.enum(["PRIMARY","SECONDARY"]),primaryUnitId:z.string().guid(),secondaryUnitId:z.string().guid(),secondaryUnitsPerBase:z.string().refine(validUnitConversionRate),unitName:z.string().max(80),unitSymbol:z.string().max(20)}).refine(value=>value.primaryUnitId!==value.secondaryUnitId);
export type CommercialUnitSnapshot=z.infer<typeof snapshotSchema>;
export function parseCommercialUnitSnapshot(value:unknown):CommercialUnitSnapshot{
 const parsed=snapshotSchema.safeParse(value);
 if(!parsed.success)throw new Error("INVALID_UNIT_SNAPSHOT");
 return parsed.data;
}
type Unit={id:string;name:string;symbol:string;isActive?:boolean};
type Master={unit?:Unit|null;secondaryUnit?:Unit|null;secondaryUnitsPerBase?:{toString():string}|string|null};
type Source={unitConversionSnapshot:unknown;unitName:string|null;unitSymbol:string|null};
/** The source document, rather than today's master conversion, owns return-unit semantics. */
export function resolveCommercialUnitSnapshot(input:{quantity:string;selection?:ItemUnitSelection;master?:Master|null},source?:Source){
 let snapshot:CommercialUnitSnapshot|undefined;
 if(source?.unitConversionSnapshot!=null){
  snapshot=parseCommercialUnitSnapshot(source.unitConversionSnapshot);
  if(input.selection&&input.selection!==snapshot.selection)throw new Error("SOURCE_UNIT_MISMATCH");
 }else if(source){
  if(input.selection==="SECONDARY")throw new Error("SOURCE_UNIT_MISMATCH");
 }else{
  const selection=input.selection??"PRIMARY",master=input.master;
  if(master?.unit?.isActive===false)throw new Error("UNIT_CONVERSION_UNAVAILABLE");
  if(master?.unit&&master.secondaryUnit&&master.secondaryUnitsPerBase!=null){
   if(selection==="SECONDARY"&&master.secondaryUnit.isActive===false)throw new Error("UNIT_CONVERSION_UNAVAILABLE");
   const unit=selection==="SECONDARY"?master.secondaryUnit:master.unit;
   const parsed=snapshotSchema.safeParse({version:1,selection,primaryUnitId:master.unit.id,secondaryUnitId:master.secondaryUnit.id,secondaryUnitsPerBase:master.secondaryUnitsPerBase.toString(),unitName:unit.name,unitSymbol:unit.symbol});
   if(!parsed.success||master.unit.id===master.secondaryUnit.id)throw new Error("INVALID_UNIT_SNAPSHOT");
   snapshot=parsed.data;
  }else if(selection==="SECONDARY")throw new Error("UNIT_CONVERSION_UNAVAILABLE");
 }
 const selection=snapshot?.selection??"PRIMARY";
 return {baseQuantity:quantityInBaseUnits(input.quantity,selection,snapshot?.secondaryUnitsPerBase),snapshot,unitName:source?(source.unitName??snapshot?.unitName):(snapshot?.unitName??input.master?.unit?.name),unitSymbol:source?(source.unitSymbol??snapshot?.unitSymbol):(snapshot?.unitSymbol??input.master?.unit?.symbol)};
}
