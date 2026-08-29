import {authenticateMobileToken,mobileBootstrap} from '@/lib/mobile/auth';import {mobileError,mobileJson} from '@/lib/mobile/http';
export async function GET(request:Request){try{return mobileJson(await mobileBootstrap(await authenticateMobileToken(request.headers.get('authorization'))))}catch{return mobileError()}}
