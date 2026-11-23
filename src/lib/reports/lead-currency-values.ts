import {Prisma,type LeadStage} from '@prisma/client';
import {leadValues} from './metrics';
/** Retain the recorded currency; this report never performs implicit FX conversion. */
export function leadCurrencyValues(rows:{stage:LeadStage;estimatedValue:Prisma.Decimal|null;currencyCode:string}[]){
 const groups=new Map<string,typeof rows>();
 for(const row of rows){const currency=row.currencyCode?.trim().toUpperCase()||'UNSPECIFIED';const group=groups.get(currency);if(group)group.push(row);else groups.set(currency,[row])}
 const values=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([currency,leads])=>({currency,...leadValues(leads)}));
 return{pipelineValue:values.map(v=>`${v.currency} ${v.pipeline.toFixed(2)}`).join(' · ')||'—',wonValue:values.map(v=>`${v.currency} ${v.won.toFixed(2)}`).join(' · ')||'—'};
}
