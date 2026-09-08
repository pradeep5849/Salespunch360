import {NextResponse} from 'next/server';
export const mobileJson=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export const mobileError=(status=401)=>mobileJson({error:status===429?'Too many attempts. Try again later.':'Unable to complete request.'},status);

export const mobileUnauthorized=(error:unknown)=>error instanceof Error&&error.message==='MOBILE_UNAUTHORIZED'?mobileJson({error:'UNAUTHORIZED'},401):null;
