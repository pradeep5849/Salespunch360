import {db} from '@/lib/db';
import {mobileCan,type MobilePrincipal} from './auth';

const fields=['name','addressLine1','addressLine2','locality','city','state','postalCode','country','primaryContactName','primaryPhone','contactEmail','alternatePhone','website','gstin','pan','registrationNumber','description','teamStructure','enabledModules'] as const;
export async function mobileReadOnlyCompanyDetails(actor:MobilePrincipal){
 if(!mobileCan(actor,'COMPANY_VIEW'))throw new Error('MOBILE_FORBIDDEN');
 const company=await db.company.findUnique({where:{id:actor.companyId},select:Object.fromEntries(fields.map(key=>[key,true])) as Record<typeof fields[number],true>});
 if(!company)throw new Error('NOT_FOUND');
 // Explicit DTO: no settings, entitlement, prices, IDs, slug or storage object key.
 return {company:Object.fromEntries(fields.map(key=>[key,company[key]]))};
}
