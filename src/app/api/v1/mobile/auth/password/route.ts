import {authenticateMobileToken} from '@/lib/mobile/auth';
import {mobilePasswordSchema} from '@/lib/mobile/validation';
import {hashPassword,verifyPassword} from '@/lib/auth/crypto';
import {db} from '@/lib/db';
import {mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {replacePasswordAndRevoke} from '@/lib/auth/session-generation';

export async function POST(request:Request){
 try{
  const principal=await authenticateMobileToken(request.headers.get('authorization'));
  const parsed=mobilePasswordSchema.safeParse(await request.json());if(!parsed.success)return mobileJson({error:'INVALID_INPUT'},400);
  const user=await db.user.findFirst({where:{id:principal.id,companyId:principal.companyId,isActive:true},select:{passwordHash:true}});
  if(!user||!await verifyPassword(user.passwordHash,parsed.data.currentPassword))return mobileJson({error:'CURRENT_PASSWORD_INCORRECT'},403);
  const passwordHash=await hashPassword(parsed.data.newPassword);
  await replacePasswordAndRevoke(principal.id,passwordHash,user.passwordHash);
  return mobileJson({ok:true});
 }catch(error){const unauthorized=mobileUnauthorized(error);if(unauthorized)return unauthorized;if(error instanceof SyntaxError)return mobileJson({error:'INVALID_INPUT'},400);return mobileUnexpected('MOBILE_PASSWORD',error)}
}
