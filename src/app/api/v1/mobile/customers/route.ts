import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileAssignCustomer,mobileCreateCustomer,mobileCustomerAdminContext} from '@/lib/mobile/customers';
import {MobileCompanyError} from '@/lib/mobile/company';
import {mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {ZodError} from 'zod';
const principal=(request:Request)=>authenticateMobileSalesToken(request.headers.get('authorization'));
function failure(error:unknown){if(error instanceof MobileCompanyError)return mobileJson({error:error.code},error.status);const expected=mobileUnauthorized(error)??mobileBranchFailure(error);if(expected)return expected;if(error instanceof ZodError||error instanceof SyntaxError)return mobileJson({error:'INVALID_INPUT'},400);return mobileUnexpected('MOBILE_CUSTOMERS',error)}
export async function GET(request:Request){try{return mobileJson(await mobileCustomerAdminContext(await principal(request)))}catch(error){return failure(error)}}
export async function POST(request:Request){try{const p=await principal(request),body=await request.json();if(body?.action==='ASSIGN')return mobileJson(await mobileAssignCustomer(p,body));return mobileJson(await mobileCreateCustomer(p,body),201)}catch(error){return failure(error)}}
