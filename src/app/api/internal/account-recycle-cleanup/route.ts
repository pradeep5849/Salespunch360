import { authorizedJobRunner } from "@/lib/field-jobs/service";
import { purgeExpiredRecycleRecords } from "@/lib/account/recycle-retention";
export async function POST(request: Request) {
  if (!authorizedJobRunner(request.headers.get("authorization")))
    return Response.json({error:"UNAUTHORIZED"},{status:401,headers:{"Cache-Control":"no-store"}});
  return Response.json(await purgeExpiredRecycleRecords(),{headers:{"Cache-Control":"no-store"}});
}
