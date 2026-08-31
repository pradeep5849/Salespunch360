import { NextResponse, type NextRequest } from "next/server";

const recognized=/^(salespunch360\.com|www\.salespunch360\.com)(?::([1-9][0-9]{0,4}))?$/i;
function normalizeHost(value:string|null){if(!value)return null;const candidate=value.trim();const match=recognized.exec(candidate);if(!match)return null;if(match[2]&&Number(match[2])>65535)return null;return match[1].toLowerCase();}
function requestHost(request:NextRequest){
  const direct=normalizeHost(request.headers.get("host"))??normalizeHost(request.nextUrl.host);
  if(process.env.TRUST_PROXY!=="true")return direct;
  const forwarded=request.headers.get("x-forwarded-host")?.split(",")[0]??null;
  return normalizeHost(forwarded)??direct;
}
export function proxy(request:NextRequest){
  if(process.env.NODE_ENV!=="production")return NextResponse.next();
  const host=requestHost(request);
  if(host!=="salespunch360.com")return NextResponse.next();
  if(request.nextUrl.pathname.startsWith("/api/"))return NextResponse.json({error:"CANONICAL_API_HOST_REQUIRED"},{status:421});
  const canonical=request.nextUrl.clone();canonical.protocol="https:";canonical.host="www.salespunch360.com";
  return NextResponse.redirect(canonical,308);
}
export const config={matcher:"/:path*"};
