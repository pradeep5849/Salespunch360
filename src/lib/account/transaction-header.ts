import {z} from "zod";

export const transactionHeaderFields={
 billingName:z.string().trim().max(240).optional(),
 customerPoNumber:z.string().trim().max(100).optional(),
 customerPoDate:z.coerce.date().optional(),
 transactionTime:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
 ewayBillNumber:z.string().regex(/^\d{12}$/).optional(),
};
export function transactionHeaderPrintFields(input:{customerPoNumber?:string|null;customerPoDate?:Date|null;transactionTime?:string|null;ewayBillNumber?:string|null},formatDate:(date:Date)=>string){
 return [
  input.customerPoNumber?{label:"Customer PO",value:input.customerPoNumber}:null,
  input.customerPoDate?{label:"PO date",value:formatDate(input.customerPoDate)}:null,
  input.transactionTime?{label:"Transaction time",value:input.transactionTime}:null,
  input.ewayBillNumber?{label:"E-Way Bill No.",value:input.ewayBillNumber}:null,
 ].filter((field):field is {label:string;value:string}=>field!==null);
}
