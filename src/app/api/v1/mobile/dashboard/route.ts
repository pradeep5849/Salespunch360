import {db} from '@/lib/db';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{
  const user=await authenticateMobileSalesToken(request.headers.get('authorization'));
  if(user.salesRole==='SALES')return mobileJson({error:'FORBIDDEN'},403);
  const branches=await operationalBranchContext(user);
  const isAdmin=user.salesRole==='PRIMARY_ADMIN'||user.salesRole==='ADMIN';
  const employees=await db.user.findMany({
   where:isAdmin?{companyId:user.companyId,salesRole:{in:['MANAGER','SALES']},salesAccessActive:true,isActive:true}:{companyId:user.companyId,salesRole:'SALES',salesAccessActive:true,isActive:true,managerId:user.id},
   select:{id:true,name:true,salesRole:true,managerType:true},orderBy:{name:'asc'}
  });
  const requested=new URL(request.url).searchParams.get('liveEmployee');
  const allowed=new Set(employees.map(employee=>employee.id));
  const liveUserId=requested&&allowed.has(requested)?requested:null;
  const point=liveUserId?await db.locationPoint.findFirst({where:{companyId:user.companyId,branchId:branches.branchId,userId:liveUserId},orderBy:[{capturedAt:'desc'},{sequenceNumber:'desc'}],select:{latitude:true,longitude:true,capturedAt:true,user:{select:{name:true}}}}):null;
  const latestLocation=point?{latitude:Number(point.latitude),longitude:Number(point.longitude),capturedAt:point.capturedAt,user:point.user}:null;
  return mobileJson({employees,liveUserId,latestLocation});
 }catch(error){const expected=mobileUnauthorized(error)??mobileBranchFailure(error);if(expected)return expected;return mobileUnexpected('MOBILE_DASHBOARD',error)}
}
