import {revokeMobileToken} from '@/lib/mobile/auth';import {mobileJson} from '@/lib/mobile/http';
export async function POST(request:Request){await revokeMobileToken(request.headers.get('authorization'));return mobileJson({ok:true})}
