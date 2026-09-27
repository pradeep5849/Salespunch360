import {authorizedJobRunner,processFieldJobs} from '@/lib/field-jobs/service';
import {generateFollowUpReminders} from '@/lib/sales-notifications/service';
export async function POST(request:Request){
 if(!authorizedJobRunner(request.headers.get('authorization')))return Response.json({error:'UNAUTHORIZED'},{status:401});
 const [fieldJobs,followUpReminders]=await Promise.all([processFieldJobs(20),generateFollowUpReminders()]);
 return Response.json({fieldJobs,followUpReminders},{headers:{'Cache-Control':'no-store'}});
}
