import {z} from "zod";
/** Browser/API date-only values must not silently roll February 30 into March. */
export const calendarDateInput=z.union([z.date(),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value,context)=>{
 const date=new Date(`${value}T00:00:00.000Z`);
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value){context.addIssue({code:"custom",message:"Enter a valid calendar date"});return z.NEVER;}
 return date;
})]);
