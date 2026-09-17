import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileFollowUps} from '@/lib/mobile/follow-ups';
import {mobileBranchFailure,mobileJson,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization')),status=new URL(request.url).searchParams.get('status');return mobileJson(await mobileFollowUps(user,status));}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);return mobileUnexpected('MOBILE_FOLLOW_UPS',error);}
}
