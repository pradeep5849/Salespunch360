import {randomUUID} from "node:crypto";
import {db} from "@/lib/db";
import {privateStorage} from "@/lib/storage";
/** Call only after owner authorization and image validation. Never overwrite the old object. */
export async function storeReplacementCompanyLogo(companyId:string,bytes:Buffer){
 const key=`companies/${companyId}/branding/logos/${randomUUID()}.webp`;
 await privateStorage().put(key,bytes);
 // Keep the new object on an uncertain DB result. Deleting it could break a committed pointer.
 await db.company.update({where:{id:companyId},data:{logoObjectKey:key}});
 return key;
}
