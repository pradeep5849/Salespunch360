import {after} from 'next/server';
import {ZodError} from 'zod';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {mobileJson,mobileUnauthorized,mobileBranchFailure,mobileUnexpected} from '@/lib/mobile/http';
import {deleteOwnVisitForActor,VisitDeletionError} from '@/lib/visits/deletion';
import {retryPendingStorageDeletions} from '@/lib/storage/deletion-queue';
export async function POST(request:Request){
 try{
  const actor=await authenticateMobileSalesToken(request.headers.get('authorization'));
  const result=await deleteOwnVisitForActor(actor,await request.json());
  after(async()=>{try{await retryPendingStorageDeletions()}catch{/* Persisted cleanup retries later. */}});
  return mobileJson(result);
 }catch(error){
  const denied=mobileUnauthorized(error)??mobileBranchFailure(error);if(denied)return denied;
  if(error instanceof VisitDeletionError)return mobileJson({error:error.code},error.code==='FORBIDDEN'?403:error.code==='VISIT_NOT_FOUND'?404:409);
  if(error instanceof ZodError)return mobileJson({error:'INVALID_REQUEST'},400);
  return mobileUnexpected('MOBILE_VISIT_DELETE',error);
 }
}
