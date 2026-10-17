import {expect,it} from "vitest";
import {resolveCommercialUnitSnapshot} from "./commercial-unit-snapshot";
const master={unit:{id:"00000000-0000-4000-8000-000000000001",name:"Bundle",symbol:"bndl"},secondaryUnit:{id:"00000000-0000-4000-8000-000000000002",name:"Piece",symbol:"pc"},secondaryUnitsPerBase:"10"};
it("records selected-unit labels and immutable quantity semantics",()=>{
 const result=resolveCommercialUnitSnapshot({quantity:"20",selection:"SECONDARY",master});
 expect(result).toMatchObject({baseQuantity:"2.0000",unitName:"Piece",unitSymbol:"pc",snapshot:{version:1,selection:"SECONDARY",secondaryUnitsPerBase:"10"}});
 expect(resolveCommercialUnitSnapshot({quantity:"2",selection:"PRIMARY",master}).baseQuantity).toBe("2.0000");
});
it("returns use the retained factor and labels even after today's master changes",()=>{
 const saved=resolveCommercialUnitSnapshot({quantity:"20",selection:"SECONDARY",master});
 const source={unitConversionSnapshot:saved.snapshot,unitName:"Original piece",unitSymbol:"old-pc"};
 expect(resolveCommercialUnitSnapshot({quantity:"5",master:{...master,secondaryUnitsPerBase:"12",secondaryUnit:{...master.secondaryUnit,name:"Changed unit",isActive:false}}},source)).toMatchObject({baseQuantity:"0.5000",unitName:"Original piece",unitSymbol:"old-pc",snapshot:{secondaryUnitsPerBase:"10"}});
 expect(()=>resolveCommercialUnitSnapshot({quantity:"5",selection:"PRIMARY",master},source)).toThrow("SOURCE_UNIT_MISMATCH");
});
it("legacy source quantities keep their original meaning and cannot acquire a guessed conversion",()=>{
 const source={unitConversionSnapshot:null,unitName:"Historical unit",unitSymbol:"hist"};
 expect(resolveCommercialUnitSnapshot({quantity:"2",master},source)).toMatchObject({baseQuantity:"2.0000",unitName:"Historical unit",snapshot:undefined});
 expect(()=>resolveCommercialUnitSnapshot({quantity:"2",selection:"SECONDARY",master},source)).toThrow("SOURCE_UNIT_MISMATCH");
 expect(resolveCommercialUnitSnapshot({quantity:"2",master},{...source,unitName:null,unitSymbol:null})).toMatchObject({unitName:undefined,unitSymbol:undefined});
});
it("rejects malformed source metadata and unavailable secondary units",()=>{
 expect(()=>resolveCommercialUnitSnapshot({quantity:"1",master},{unitConversionSnapshot:{version:1,secondaryUnitsPerBase:"0"},unitName:null,unitSymbol:null})).toThrow("INVALID_UNIT_SNAPSHOT");
 expect(()=>resolveCommercialUnitSnapshot({quantity:"1",selection:"SECONDARY"})).toThrow("UNIT_CONVERSION_UNAVAILABLE");
 expect(()=>resolveCommercialUnitSnapshot({quantity:"1",selection:"SECONDARY",master:{...master,secondaryUnit:{...master.secondaryUnit,isActive:false}}})).toThrow("UNIT_CONVERSION_UNAVAILABLE");
});
