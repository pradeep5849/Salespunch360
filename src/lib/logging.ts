type Context={correlationId?:string;category:string;userId?:string;companyId?:string;code?:string};
export function logEvent(level:'info'|'warn'|'error',context:Context){const safe={timestamp:new Date().toISOString(),level,...context};const output=JSON.stringify(safe);if(level==='error')console.error(output);else if(level==='warn')console.warn(output);else console.info(output)}
