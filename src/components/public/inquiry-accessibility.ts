export function inquiryErrorAttributes(name:string,hasError:boolean){return hasError?{"aria-invalid":true as const,"aria-describedby":`${name}-error`}:{"aria-invalid":false as const}}
