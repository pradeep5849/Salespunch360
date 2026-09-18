import {NextResponse} from 'next/server';
import {mutationGuard} from '@/lib/security/request';
import {createFollowUpTask} from '@/lib/follow-up-tasks/service';
export async function POST(request:Request){try{await mutationGuard('follow-up-create',120);const body=await request.json();await createFollowUpTask(body);return NextResponse.json({ok:true});}catch(error){const code=error instanceof Error?error.message:'FAILED';return NextResponse.json({ok:false,error:code},{status:code==='RATE_LIMITED'?429:400});}}
