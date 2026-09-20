import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileFollowUps} from '@/lib/mobile/follow-ups';
import {cancelFollowUpTaskForActor,FollowUpTaskError} from '@/lib/follow-up-tasks/service';
import {mobileBranchFailure,mobileJson,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization')),params=new URL(request.url).searchParams,status=params.get('status');return mobileJson(await mobileFollowUps(user,status,params.get('employeeId')));}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);return mobileUnexpected('MOBILE_FOLLOW_UPS',error);}
}
export async function POST(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization'));const body=await request.json() as {action?:unknown;taskId?:unknown};if(body.action!=='CANCEL'||typeof body.taskId!=='string'||!body.taskId)return mobileJson({error:'INVALID_REQUEST'},400);await cancelFollowUpTaskForActor(user,body.taskId);return mobileJson({ok:true});}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof FollowUpTaskError?error.code:error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);if(code==='NOT_FOUND')return mobileJson({error:'NOT_FOUND'},404);if(code==='INVALID_STATE')return mobileJson({error:'INVALID_STATE'},409);return mobileUnexpected('MOBILE_FOLLOW_UP_CANCEL',error);}
}
