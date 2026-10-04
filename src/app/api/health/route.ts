import {randomUUID} from 'node:crypto';
import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {logEvent} from '@/lib/logging';
export const dynamic='force-dynamic';
export async function GET(){
  const referenceId=randomUUID(), started=performance.now();
  const headers={'Cache-Control':'no-store','X-Request-ID':referenceId};
  try{
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({status:'ready',database:'reachable'},{headers});
  }catch{
    logEvent('error',{category:'HEALTH_CHECK',correlationId:referenceId,durationMs:Math.round(performance.now()-started)});
    return NextResponse.json({status:'not-ready',database:'unreachable'},{status:503,headers});
  }
}
