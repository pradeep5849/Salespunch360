import {revokeMobileToken} from '@/lib/mobile/auth';import {mobileJson,mobileUnexpected} from '@/lib/mobile/http';
export async function POST(request:Request){try{await revokeMobileToken(request.headers.get('authorization'));return mobileJson({ok:true})}catch(error){return mobileUnexpected('MOBILE_LOGOUT',error)}}
