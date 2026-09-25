import {db} from '@/lib/db';
import {verifyPassword} from '@/lib/auth/crypto';
import {isMobileEligible} from './auth';

export class MobileDeviceMismatchError extends Error {
  constructor(){super('MOBILE_DEVICE_MISMATCH')}
}

export async function verifyAndBindMobileDevice(identifier:string,password:string,deviceId:string,deviceName:string|null){
  const user=await db.user.findFirst({
    where:{OR:[{email:identifier.toLowerCase()},{phone:identifier}]},
    select:{
      id:true,passwordHash:true,role:true,salesRole:true,accountRole:true,
      salesAccessActive:true,accountAccessActive:true,managerType:true,designation:true,
      companyId:true,isActive:true,company:{select:{productEdition:true}},
    },
  });
  if(!user||!isMobileEligible(user,user.company?.productEdition??null)||!(await verifyPassword(user.passwordHash,password)))throw new Error('INVALID_MOBILE_CREDENTIALS');
  const rows=await db.$queryRaw<{deviceId:string}[]>`
    INSERT INTO "mobile_device_bindings" ("userId","deviceId","deviceName","registeredAt","updatedAt")
    VALUES (${user.id}::uuid,${deviceId},${deviceName},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE
      SET "deviceName"=EXCLUDED."deviceName","updatedAt"=CURRENT_TIMESTAMP
      WHERE "mobile_device_bindings"."deviceId"=EXCLUDED."deviceId"
    RETURNING "deviceId"
  `;
  if(rows.length===0)throw new MobileDeviceMismatchError();
}

export async function resetMobileDeviceForUser(companyId:string,userId:string){
  const target=await db.user.findFirst({where:{id:userId,companyId},select:{id:true}});
  if(!target)throw new Error('NOT_FOUND');
  await db.$transaction(async tx=>{
    const sessions=await tx.mobileSession.findMany({where:{userId},select:{id:true}});
    if(sessions.length){
      await tx.pushDevice.deleteMany({where:{mobileSessionId:{in:sessions.map(session=>session.id)}}});
    }
    await tx.mobileSession.updateMany({
      where:{userId,revokedAt:null},
      data:{revokedAt:new Date(),webHandoffCodeHash:null,webHandoffExpiresAt:null,webHandoffRedirectPath:null},
    });
    await tx.$executeRaw`DELETE FROM "mobile_device_bindings" WHERE "userId"=${userId}::uuid`;
  });
  return{success:true};
}
