import {db} from '@/lib/db';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';

export async function GET(request:Request){
 try{
  const user=await authenticateMobileSalesToken(request.headers.get('authorization'));
  if(!user.companyId||user.salesRole==='SALES')return mobileJson({error:'FORBIDDEN'},403);
  const branches=await operationalBranchContext(user);
  const employees=await db.user.findMany({
   where:{companyId:user.companyId,...(user.salesRole==='MANAGER'?{salesRole:'SALES' as const,managerId:user.id,salesAccessActive:true,isActive:true}:{salesRole:{in:['MANAGER','SALES'] as const},salesAccessActive:true,isActive:true})},
   select:{id:true,name:true,salesRole:true,isActive:true,attendances:{where:{branchId:branches.branchId,endedAt:null},take:1,select:{id:true,startedAt:true,_count:{select:{locationPoints:true}}}}},
   orderBy:{name:'asc'}
  });
  return mobileJson({employees:employees.map(employee=>{const open=employee.attendances[0];return{id:employee.id,name:employee.name,salesRole:employee.salesRole,isActive:employee.isActive,working:Boolean(open),startedAt:open?.startedAt??null,gpsPointCount:open?._count.locationPoints??0}})});
 }catch(error){const expected=mobileUnauthorized(error)??mobileBranchFailure(error);if(expected)return expected;return mobileUnexpected('MOBILE_ATTENDANCE_OVERVIEW',error)}
}
