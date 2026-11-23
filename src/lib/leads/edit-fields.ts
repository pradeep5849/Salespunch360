const nullableKeys = ['customerId','contactName','phone','email','companyName','notes'] as const;
type NullableKey = typeof nullableKeys[number];
/** Omitted fields are untouched; an explicitly submitted blank/null clears them. */
export function nullableLeadEditFields(raw:unknown,parsed:Partial<Record<NullableKey,string|undefined>>){
 const input=raw&&typeof raw==='object'?raw:{};
 const updates:Partial<Record<NullableKey,string|null|undefined>>={};
 for(const key of nullableKeys) updates[key]=Object.hasOwn(input,key)?parsed[key]??null:undefined;
 return updates;
}
export function suppliedLeadEditValue(input:Record<string,unknown>,key:string,current:unknown){
 return Object.hasOwn(input,key)?input[key]:current;
}
