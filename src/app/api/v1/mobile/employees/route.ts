import {authenticateMobileToken} from '@/lib/mobile/auth';
import {mobileCreateEmployee,mobileEmployeeContext,mobileSetEmployeeActive,MobileEmployeeError} from '@/lib/mobile/employees';
import {mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {EmployeePolicyError} from '@/lib/employees/policy';
import {ZodError} from 'zod';
const principal=(request:Request)=>authenticateMobileToken(request.headers.get('authorization'));
function failure(error:unknown){if(error instanceof MobileEmployeeError)return mobileJson({error:error.code},error.status);const expected=mobileUnauthorized(error)??mobileBranchFailure(error);if(expected)return expected;const code=error instanceof EmployeePolicyError?error.code:error instanceof Error?error.message:'';if(code==='BRANCH_FORBIDDEN')return mobileJson({error:code},403);if(code==='NOT_FOUND')return mobileJson({error:code},404);if(['BRANCH_REQUIRED','INVALID_BRANCH'].includes(code))return mobileJson({error:code},400);if(['SEAT_LIMIT','LIFECYCLE_BLOCKED','MANAGERS_DISABLED','INVALID_MANAGER','EMAIL_VERIFICATION_REQUIRED','COMPANY_PROFILE_REQUIRED','PHONE_IN_USE','EMAIL_IN_USE','MANAGER_TYPE_CONFLICT'].includes(code))return mobileJson({error:code},409);if(error instanceof SyntaxError||error instanceof ZodError)return mobileJson({error:'INVALID_INPUT'},400);return mobileUnexpected('MOBILE_EMPLOYEES',error)}
export async function GET(request:Request){try{return mobileJson(await mobileEmployeeContext(await principal(request)))}catch(error){return failure(error)}}
export async function POST(request:Request){try{return mobileJson(await mobileCreateEmployee(await principal(request),await request.json()),201)}catch(error){return failure(error)}}
export async function PATCH(request:Request){try{return mobileJson(await mobileSetEmployeeActive(await principal(request),await request.json()))}catch(error){return failure(error)}}
