import {authorizedJobRunner} from '@/lib/field-jobs/service';
import {generateFollowUpReminders} from '@/lib/sales-notifications/service';
export async function POST(request:Request){
 if(!authorizedJobRunner(request.headers.get('authorization')))return Response.json({error:'UNAUTHORIZED'},{status:401});
 return Response.json(await generateFollowUpReminders(),{headers:{'Cache-Control':'no-store'}});
}
