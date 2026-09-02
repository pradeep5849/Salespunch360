import {authenticateMobileToken} from '@/lib/mobile/auth';
import {mobileError,mobileJson} from '@/lib/mobile/http';
import {registerPushDevice} from '@/lib/push/registration';
export async function POST(request:Request){
 let principal;
 try{principal=await authenticateMobileToken(request.headers.get('authorization'));}catch{return mobileError(401);}
 try{return mobileJson(await registerPushDevice(principal,await request.json()));}catch{return mobileError(400);}
}
