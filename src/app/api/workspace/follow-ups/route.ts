import {NextResponse} from 'next/server';
import {mutationGuard} from '@/lib/security/request';
import {createFollowUpTask} from '@/lib/follow-up-tasks/service';
import {createTelecallerCallFollowUpForActor} from '@/lib/follow-up-tasks/telecaller-assignment';
import {requirePermissionForMutation} from '@/lib/auth/authorization';
export async function POST(request:Request){try{await mutationGuard('follow-up-create',120);const body=await request.json();if(body?.assignedUserId){const user=await requirePermissionForMutation('SALES_FOLLOW_UPS');if(!user.companyId||!user.salesRole)throw new Error('NOT_AUTHORIZED');await createTelecallerCallFollowUpForActor({...user,companyId:user.companyId,salesRole:user.salesRole},body);}else await createFollowUpTask(body);return NextResponse.json({ok:true});}catch(error){const code=error instanceof Error?error.message:'FAILED';return NextResponse.json({ok:false,error:code},{status:code==='RATE_LIMITED'?429:code==='NOT_AUTHORIZED'?403:400});}}
