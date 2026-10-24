/** Shared input bounds for the conversion editor and persisted unit rules. */
export function validUnitConversionRate(value:string){return /^\d{1,14}(?:\.\d{1,4})?$/.test(value)&&/[1-9]/.test(value);}
