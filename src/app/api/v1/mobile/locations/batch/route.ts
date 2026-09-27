import {z} from 'zod';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileUploadPoint} from '@/lib/mobile/attendance';
import {mobilePointSchema} from '@/lib/mobile/validation';
import {mobileJson} from '@/lib/mobile/http';
import {mobileLocationFailure} from '../route';
const schema=z.object({points:z.array(mobilePointSchema).min(1).max(50)}).strict();
const rejected=new Set(['CAPTURE_TIME_INVALID','NO_OPEN_ATTENDANCE','THROTTLED']);
export async function POST(request:Request){
 try{
  const user=await authenticateMobileSalesToken(request.headers.get('authorization'));
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return mobileJson({error:'INVALID_INPUT'},400);
  const results=[];
  for(const point of parsed.data.points){
   try{results.push({clientPointId:point.clientPointId,...await mobileUploadPoint(user,point)});}
   catch(error){const code=error instanceof Error?error.message:'';if(!rejected.has(code))throw error;results.push({clientPointId:point.clientPointId,acknowledged:false,error:code});}
  }
  return mobileJson({results,receivedAt:new Date().toISOString()});
 }catch(error){return mobileLocationFailure(error)}
}
