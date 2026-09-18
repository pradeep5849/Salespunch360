import {NextResponse} from 'next/server';
import {mutationGuard} from '@/lib/security/request';
import {transitionLead} from '@/lib/leads/service';
export async function POST(request:Request){try{await mutationGuard('lead-stage',120);const body=await request.json();await transitionLead(body);return NextResponse.json({ok:true});}catch(error){const code=error instanceof Error?error.message:'FAILED';return NextResponse.json({ok:false,error:code},{status:code==='RATE_LIMITED'?429:400});}}
