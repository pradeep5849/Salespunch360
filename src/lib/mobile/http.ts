import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {logEvent} from '@/lib/logging';
import {OperationalBranchError} from '@/lib/branches/operational-scope';
import {AuthorizationError} from '@/lib/auth/authorization';
export const mobileJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const mobileError=(status=401)=>mobileJson({error:status===429?'Too many attempts. Try again later.':'Unable to complete request.'},status);

export const mobileUnauthorized=(error:unknown)=>error instanceof Error&&error.message==='MOBILE_UNAUTHORIZED'?mobileJson({error:'UNAUTHORIZED'},401):error instanceof Error&&error.message==='MOBILE_FORBIDDEN'?mobileJson({error:'FORBIDDEN'},403):null;
export const mobileBranchFailure=(error:unknown)=>error instanceof OperationalBranchError?mobileJson({error:error.code},error.code==='BRANCH_REQUIRED'?400:403):null;
export const mobileAuthorizationFailure=(error:unknown)=>error instanceof AuthorizationError||error instanceof Error&&(error.message==='NOT_AUTHORIZED'||error.message==='Not authorized')?mobileJson({error:'FORBIDDEN'},403):null;
export function mobileUnexpected(category:string,error:unknown){const referenceId=randomUUID(),code=typeof error==='object'&&error&&'code'in error&&typeof error.code==='string'&&/^P\d{4}$/.test(error.code)?error.code:undefined;logEvent('error',{category,correlationId:referenceId,code});return mobileJson({error:'SERVER_ERROR',referenceId},500)}
