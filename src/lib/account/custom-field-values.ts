import {Prisma,type CustomFieldEntity,type CustomFieldDefinition} from "@prisma/client";
import {z} from "zod";

export function parseCustomFieldValue(field:Pick<CustomFieldDefinition,"fieldKey"|"dataType"|"options"|"isRequired">,raw:unknown):Prisma.InputJsonValue|undefined{
 if(raw===undefined||raw===null||raw===""){
  if(field.isRequired)throw new Error(`CUSTOM_FIELDS_REQUIRED:${field.fieldKey}`);
  return undefined;
 }
 try{
  switch(field.dataType){
   case "NUMBER":return z.coerce.number().finite().parse(raw);
   case "DECIMAL":return z.string().regex(/^-?\d{1,16}(\.\d{1,6})?$/).parse(String(raw));
   case "DATE":{const value=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(raw);if(new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value)throw new Error();return value}
   case "BOOLEAN":if(raw===true||raw==="true"||raw==="on")return true;if(raw===false||raw==="false"||raw==="off")return false;throw new Error();
   case "SELECT":{const value=z.string().parse(raw);if(!Array.isArray(field.options)||!field.options.includes(value))throw new Error();return value}
   default:return z.string().trim().min(field.isRequired?1:0).max(10000).parse(raw);
  }
 }catch{throw new Error(`INVALID_CUSTOM_FIELD:${field.fieldKey}`)}
}
export async function saveCustomFieldValuesInTx(tx:Prisma.TransactionClient,companyId:string,entityType:CustomFieldEntity,entityId:string,values:Record<string,unknown>,partial=false){
 const definitions=await tx.customFieldDefinition.findMany({where:{companyId,entityType,isActive:true}});
 for(const definition of definitions){
  if(partial&&values[definition.fieldKey]===undefined)continue;
  const value=parseCustomFieldValue(definition,values[definition.fieldKey]);
  if(value===undefined)continue;
  await tx.customFieldValue.upsert({where:{companyId_definitionId_entityId:{companyId,definitionId:definition.id,entityId}},create:{companyId,definitionId:definition.id,entityType,entityId,value},update:{value}});
 }
}
