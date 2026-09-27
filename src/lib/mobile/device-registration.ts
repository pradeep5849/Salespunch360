import type {Prisma} from '@prisma/client';
import {requiresMobileDeviceLock} from '@/lib/auth/workspace-policy';
export class MobileDeviceMismatchError extends Error {constructor(){super('MOBILE_DEVICE_MISMATCH')}}
export async function bindMobileDevice(tx:Prisma.TransactionClient,user:Parameters<typeof requiresMobileDeviceLock>[0]&{id:string},deviceId:string,deviceName:string|null){
  if(!requiresMobileDeviceLock(user)){
    await tx.$executeRaw`DELETE FROM "mobile_device_bindings" WHERE "userId"=${user.id}::uuid`;
    return;
  }
  const rows=await tx.$queryRaw<{deviceId:string}[]>`
    INSERT INTO "mobile_device_bindings" ("userId","deviceId","deviceName","registeredAt","updatedAt")
    VALUES (${user.id}::uuid,${deviceId},${deviceName},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE
      SET "deviceName"=EXCLUDED."deviceName","updatedAt"=CURRENT_TIMESTAMP
      WHERE "mobile_device_bindings"."deviceId"=EXCLUDED."deviceId"
    RETURNING "deviceId"
  `;
  if(rows.length===0)throw new MobileDeviceMismatchError();
}
