import {generateScheduledAccountBackups} from "@/lib/account/backup-settings";
import {generateAccountPaymentReminders} from "@/lib/account/payment-reminder-execution";
import {authorizedJobRunner,processFieldJobs} from '@/lib/field-jobs/service';
import {generateFollowUpReminders} from '@/lib/sales-notifications/service';
export async function POST(request:Request){
 if(!authorizedJobRunner(request.headers.get('authorization')))return Response.json({error:'UNAUTHORIZED'},{status:401});
 const [fieldJobs,followUpReminders,accountReminders,accountBackups]=await Promise.all([processFieldJobs(20),generateFollowUpReminders(),generateAccountPaymentReminders(),generateScheduledAccountBackups()]);
 return Response.json({fieldJobs,followUpReminders,accountReminders,accountBackups},{headers:{'Cache-Control':'no-store'}});
}
