import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileFollowUps} from '@/lib/mobile/follow-ups';
import {cancelFollowUpTaskForActor,createFollowUpTaskForActor,FollowUpTaskError} from '@/lib/follow-up-tasks/service';
import {completeCallFollowUpTaskForActor} from '@/lib/follow-up-tasks/call-completion';
import {createTelecallerCallFollowUpForActor,telecallerOptionsForCompany} from '@/lib/follow-up-tasks/telecaller-assignment';
import {mobileBranchFailure,mobileJson,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization')),params=new URL(request.url).searchParams;if(params.get('view')==='telecallers')return mobileJson(await telecallerOptionsForCompany(user.companyId));const status=params.get('status');return mobileJson(await mobileFollowUps(user,status,params.get('employeeId')));}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN')return mobileJson({error:'FORBIDDEN'},403);return mobileUnexpected('MOBILE_FOLLOW_UPS',error);}
}
export async function POST(request:Request){
 try{const user=await authenticateMobileSalesToken(request.headers.get('authorization'));const body=await request.json() as Record<string,unknown>;if(body.action==='CREATE'){if(body.assignedUserId)await createTelecallerCallFollowUpForActor(user,body as never);else await createFollowUpTaskForActor(user,body as never);return mobileJson({ok:true},201);}if(typeof body.taskId!=='string'||!body.taskId)return mobileJson({error:'INVALID_REQUEST'},400);if(body.action==='CANCEL')await cancelFollowUpTaskForActor(user,body.taskId);else if(body.action==='COMPLETE_CALL')await completeCallFollowUpTaskForActor(user,body.taskId,body.outcomeNote);else return mobileJson({error:'INVALID_REQUEST'},400);return mobileJson({ok:true});}
 catch(error){const branch=mobileBranchFailure(error);if(branch)return branch;const code=error instanceof FollowUpTaskError?error.code:error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(code==='MOBILE_FORBIDDEN'||code==='FORBIDDEN'||code==='NOT_AUTHORIZED')return mobileJson({error:'FORBIDDEN'},403);if(code==='NOT_FOUND')return mobileJson({error:'NOT_FOUND'},404);if(code==='INVALID_STATE')return mobileJson({error:'INVALID_STATE'},409);if(['INVALID_TYPE','INVALID_DATE','INVALID_ASSIGNMENT'].includes(code))return mobileJson({error:code},400);return mobileUnexpected('MOBILE_FOLLOW_UP_MUTATION',error);}
}
