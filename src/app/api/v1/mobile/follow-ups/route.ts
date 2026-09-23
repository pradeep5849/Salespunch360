import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileFollowUps} from '@/lib/mobile/follow-ups';
import {cancelFollowUpTaskForActor,FollowUpTaskError} from '@/lib/follow-up-tasks/service';
import {completeCallFollowUpTaskForActor} from '@/lib/follow-up-tasks/call-completion';
import {mobileBranchFailure,mobileJson,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization')),params=new URL(request.url).searchParams,status=params.get('status');return mobileJson(await mobileFollowUps(user,status,params.get('employeeId')));}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);return mobileUnexpected('MOBILE_FOLLOW_UPS',error);}
}
export async function POST(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization'));const body=await request.json() as {action?:unknown;taskId?:unknown};if(typeof body.taskId!=='string'||!body.taskId)return mobileJson({error:'INVALID_REQUEST'},400);if(body.action==='CANCEL')await cancelFollowUpTaskForActor(user,body.taskId);else if(body.action==='COMPLETE_CALL')await completeCallFollowUpTaskForActor(user,body.taskId);else return mobileJson({error:'INVALID_REQUEST'},400);return mobileJson({ok:true});}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof FollowUpTaskError?error.code:error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);if(code==='NOT_FOUND')return mobileJson({error:'NOT_FOUND'},404);if(code==='INVALID_STATE')return mobileJson({error:'INVALID_STATE'},409);if(code==='INVALID_TYPE')return mobileJson({error:'INVALID_TYPE'},400);return mobileUnexpected('MOBILE_FOLLOW_UP_MUTATION',error);}
}
