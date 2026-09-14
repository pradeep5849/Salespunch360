import { db } from "@/lib/db";
import { createSessionToken, hashSessionToken } from "@/lib/auth/crypto";
import { canAccessAccountWorkspace } from "@/lib/auth/workspace-policy";
import { lockUser } from "@/lib/auth/session-generation";
import type { MobileAppPrincipal } from "./auth";

export const WEB_HANDOFF_TTL_MS = 90_000;
export const ACCOUNT_ORIGIN = "https://www.salespunch360.com";

export function normalizeAccountRedirect(value:unknown):string {
  const raw=value===undefined?"/workspace/account":value;
  if(typeof raw!=="string"||raw.includes("\\")||raw.length>2048)throw new Error("INVALID_INPUT");
  let url:URL;try{url=new URL(raw,ACCOUNT_ORIGIN)}catch{throw new Error("INVALID_INPUT")}
  if(url.origin!==ACCOUNT_ORIGIN||!raw.startsWith("/")||raw.startsWith("//")||(url.pathname!=="/workspace/account"&&!url.pathname.startsWith("/workspace/account/")))throw new Error("INVALID_INPUT");
  return `${url.pathname}${url.search}`;
}

export async function issueWebHandoff(principal:MobileAppPrincipal,redirectValue:unknown,now=new Date()){
  if(!principal.authorizedWorkspaces.includes("ACCOUNT")||!principal.mobileSessionId)throw new Error("MOBILE_FORBIDDEN");
  const redirectPath=normalizeAccountRedirect(redirectValue),handoffCode=createSessionToken(),expiresAt=new Date(now.getTime()+WEB_HANDOFF_TTL_MS);
  const updated=await db.mobileSession.updateMany({where:{id:principal.mobileSessionId,userId:principal.id,revokedAt:null,expiresAt:{gt:now},sessionVersion:{equals:(await db.user.findUnique({where:{id:principal.id},select:{sessionVersion:true}}))?.sessionVersion}},data:{webHandoffCodeHash:hashSessionToken(handoffCode),webHandoffExpiresAt:expiresAt,webHandoffRedirectPath:redirectPath}});
  if(updated.count!==1)throw new Error("MOBILE_UNAUTHORIZED");
  return{handoffCode,expiresAt};
}

export async function consumeWebHandoff(code:string,now=new Date()){
  if(!/^[A-Za-z0-9_-]{40,}$/.test(code))throw new Error("INVALID_HANDOFF");
  const codeHash=hashSessionToken(code),candidate=await db.mobileSession.findUnique({where:{webHandoffCodeHash:codeHash},select:{id:true,userId:true}});if(!candidate)throw new Error("INVALID_HANDOFF");
  return db.$transaction(async tx=>{
    await lockUser(tx,candidate.userId);
    const mobile=await tx.mobileSession.findUnique({where:{id:candidate.id},select:{id:true,userId:true,expiresAt:true,revokedAt:true,sessionVersion:true,webHandoffCodeHash:true,webHandoffExpiresAt:true,webHandoffRedirectPath:true,user:{select:{id:true,role:true,isActive:true,companyId:true,salesRole:true,accountRole:true,salesAccessActive:true,accountAccessActive:true,managerType:true,sessionVersion:true,company:{select:{productEdition:true}}}}}});
    if(!mobile||mobile.webHandoffCodeHash!==codeHash||mobile.revokedAt||mobile.expiresAt<=now||!mobile.webHandoffExpiresAt||mobile.webHandoffExpiresAt<=now||mobile.sessionVersion!==mobile.user.sessionVersion||!mobile.user.company||!canAccessAccountWorkspace(mobile.user,mobile.user.company.productEdition))throw new Error("INVALID_HANDOFF");
    const redirectPath=normalizeAccountRedirect(mobile.webHandoffRedirectPath),webToken=createSessionToken(),webTokenHash=hashSessionToken(webToken),webExpiresAt=mobile.expiresAt;
    const consumed=await tx.mobileSession.updateMany({where:{id:mobile.id,webHandoffCodeHash:codeHash,webHandoffExpiresAt:{gt:now},revokedAt:null},data:{webHandoffCodeHash:null,webHandoffExpiresAt:null,webHandoffRedirectPath:null}});
    if(consumed.count!==1)throw new Error("INVALID_HANDOFF");
    await tx.session.deleteMany({where:{mobileSessionId:mobile.id}});
    await tx.session.create({data:{userId:mobile.userId,tokenHash:webTokenHash,sessionVersion:mobile.sessionVersion,expiresAt:webExpiresAt,mobileSessionId:mobile.id}});
    return{webToken,expiresAt:webExpiresAt,redirectPath};
  });
}
