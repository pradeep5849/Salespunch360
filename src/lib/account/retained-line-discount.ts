/** Old lines may retain their applied fixed amount without retaining the input value.
 * Recover that exact billed-line amount; never consult today's item defaults or guess a percentage.
 */
export function retainedLineDiscountValue(line:{discountType:string|null;discountValue?:{toString():string}|null;discountAmount:{toString():string}}):string|undefined{
 return line.discountValue?.toString()??(line.discountType==="FIXED"?line.discountAmount.toString():undefined);
}
