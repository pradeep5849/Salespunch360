import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileBranches,mobileCreateBranch,mobileEditBranch,mobileSetBranchActive} from '@/lib/mobile/branches';
import {MobileCompanyError} from '@/lib/mobile/company';
import {mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {ZodError} from 'zod';
const principal=(request:Request)=>authenticateMobileSalesToken(request.headers.get('authorization'));
function failure(error:unknown){if(error instanceof MobileCompanyError)return mobileJson({error:error.code},error.status);const expected=mobileUnauthorized(error);if(expected)return expected;if(error instanceof ZodError||error instanceof SyntaxError)return mobileJson({error:'INVALID_INPUT'},400);return mobileUnexpected('MOBILE_BRANCHES',error)}
export async function GET(request:Request){try{return mobileJson(await mobileBranches(await principal(request)))}catch(error){return failure(error)}}
export async function POST(request:Request){try{return mobileJson(await mobileCreateBranch(await principal(request),await request.json()),201)}catch(error){return failure(error)}}
export async function PATCH(request:Request){try{const p=await principal(request),body=await request.json();if(body?.action==='SET_ACTIVE')return mobileJson(await mobileSetBranchActive(p,String(body.branchId??''),Boolean(body.isActive)));return mobileJson(await mobileEditBranch(p,body))}catch(error){return failure(error)}}
