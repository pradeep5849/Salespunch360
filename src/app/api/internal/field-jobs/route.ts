import {authorizedJobRunner,processFieldJobs} from '@/lib/field-jobs/service';
export async function POST(request:Request){
 if(!authorizedJobRunner(request.headers.get('authorization')))return Response.json({error:'UNAUTHORIZED'},{status:401});
 return Response.json(await processFieldJobs(20),{headers:{'Cache-Control':'no-store'}});
}
