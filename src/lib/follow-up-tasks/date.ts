export const INDIA_TIME_ZONE="Asia/Kolkata";
const formatter=new Intl.DateTimeFormat("en-CA",{timeZone:INDIA_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"});
export function indiaDateText(at:Date=new Date()){const parts=Object.fromEntries(formatter.formatToParts(at).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
export function parseIndiaBusinessDate(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error("INVALID_DUE_DATE");const date=new Date(`${value}T00:00:00.000Z`);if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)throw new Error("INVALID_DUE_DATE");return date;}
export function classifyDueDate(dueDate:Date,now:Date=new Date()):"OVERDUE"|"TODAY"|"UPCOMING"{const due=dueDate.toISOString().slice(0,10),today=indiaDateText(now);return due<today?"OVERDUE":due===today?"TODAY":"UPCOMING";}
