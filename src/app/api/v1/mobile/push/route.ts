import {authenticateMobileToken} from '@/lib/mobile/auth';
import {mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {registerPushDevice} from '@/lib/push/registration';
import {ZodError} from 'zod';
export async function POST(request:Request){
 try{const principal=await authenticateMobileToken(request.headers.get('authorization'));return mobileJson(await registerPushDevice(principal,await request.json()));}catch(error){const unauthorized=mobileUnauthorized(error);if(unauthorized)return unauthorized;if(error instanceof SyntaxError||error instanceof ZodError)return mobileJson({error:'INVALID_INPUT'},400);return mobileUnexpected('MOBILE_PUSH',error)}
}
