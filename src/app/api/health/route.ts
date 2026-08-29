import {NextResponse} from 'next/server';import {db} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(){try{await db.$queryRaw`SELECT 1`;return NextResponse.json({status:'ready',database:'reachable'},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({status:'not-ready',database:'unreachable'},{status:503,headers:{'Cache-Control':'no-store'}})}}
