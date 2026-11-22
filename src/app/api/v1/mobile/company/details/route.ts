import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileReadOnlyCompanyDetails} from '@/lib/mobile/company-details';
import {mobileAuthorizationFailure,mobileJson,mobileUnexpected} from '@/lib/mobile/http';
export async function GET(request:Request){
 try{return mobileJson(await mobileReadOnlyCompanyDetails(await authenticateMobileSalesToken(request.headers.get('authorization'))));}
 catch(error){const auth=mobileAuthorizationFailure(error);if(auth)return auth;const code=error instanceof Error?error.message:'';if(code==='MOBILE_FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);if(code==='NOT_FOUND')return mobileJson({error:'NOT_FOUND'},404);return mobileUnexpected('MOBILE_COMPANY_DETAILS',error);}
}
