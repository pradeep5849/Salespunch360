import {authenticateMobileToken} from '@/lib/mobile/auth';
import {mobileCreateEmployee,mobileEmployeeContext,mobileSetEmployeeActive,MobileEmployeeError} from '@/lib/mobile/employees';
import {mobileJson} from '@/lib/mobile/http';
const principal=(request:Request)=>authenticateMobileToken(request.headers.get('authorization'));
function failure(error:unknown){if(error instanceof MobileEmployeeError)return mobileJson({error:error.code},error.status);const code=error instanceof Error?error.message:'';if(code==='MOBILE_UNAUTHORIZED')return mobileJson({error:'UNAUTHORIZED'},401);if(['SEAT_LIMIT','LIFECYCLE_BLOCKED','MANAGERS_DISABLED','INVALID_MANAGER'].includes(code))return mobileJson({error:code},409);return mobileJson({error:'INVALID_INPUT'},400)}
export async function GET(request:Request){try{return mobileJson(await mobileEmployeeContext(await principal(request)))}catch(error){return failure(error)}}
export async function POST(request:Request){try{return mobileJson(await mobileCreateEmployee(await principal(request),await request.json()),201)}catch(error){return failure(error)}}
export async function PATCH(request:Request){try{return mobileJson(await mobileSetEmployeeActive(await principal(request),await request.json()))}catch(error){return failure(error)}}
