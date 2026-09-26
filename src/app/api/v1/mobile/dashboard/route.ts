import {db} from '@/lib/db';
import {authenticateMobileSalesToken} from '@/lib/mobile/auth';
import {operationalBranchContext} from '@/lib/branches/operational-scope';
import {mobileBranchFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from '@/lib/mobile/http';
import {isTelecallerDesignation} from '@/lib/telecalling/policy';

export async function GET(request:Request){
 try{
  const user=await authenticateMobileSalesToken(request.headers.get('authorization'));
  if(user.salesRole==='SALES')return mobileJson({error:'FORBIDDEN'},403);
  const branches=await operationalBranchContext(user);
  const isAdmin=user.salesRole==='PRIMARY_ADMIN'||user.salesRole==='ADMIN';
  const fieldManager=user.salesRole==='MANAGER'&&user.managerType!=='MANAGER_ONLY';
  const [employees,company]=await Promise.all([
   db.user.findMany({where:isAdmin?{companyId:user.companyId,salesRole:{in:['MANAGER','SALES']},salesAccessActive:true,isActive:true}:{companyId:user.companyId,salesRole:'SALES',salesAccessActive:true,isActive:true,managerId:user.id},select:{id:true,name:true,salesRole:true,managerType:true,designation:true},orderBy:{name:'asc'}}),
   db.company.findUnique({where:{id:user.companyId},select:{gpsTrackingEnabled:true}})
  ]);
  const checkInEmployees=employees.filter(employee=>(employee.salesRole==='SALES'&&!isTelecallerDesignation(employee.designation))||(employee.salesRole==='MANAGER'&&employee.managerType!=='MANAGER_ONLY'));
  const liveEmployees=employees.filter(employee=>employee.salesRole==='SALES');
  const params=new URL(request.url).searchParams,allowedLive=new Set(liveEmployees.map(employee=>employee.id)),allowedCheck=new Set(checkInEmployees.map(employee=>employee.id));
  const requested=params.get('liveEmployee'),liveUserId=requested&&allowedLive.has(requested)?requested:null;
  const checkRequested=params.get('checkEmployee'),checkUserId=checkRequested&&allowedCheck.has(checkRequested)?checkRequested:null;
  const teamIds=user.salesRole==='MANAGER'&&fieldManager?[user.id,...checkInEmployees.map(employee=>employee.id)]:checkInEmployees.map(employee=>employee.id);
  const visitUserIds=checkUserId?[checkUserId]:teamIds;
  const [point,recentVisits]=await Promise.all([
   liveUserId?db.locationPoint.findFirst({where:{companyId:user.companyId,branchId:branches.branchId,userId:liveUserId},orderBy:[{capturedAt:'desc'},{sequenceNumber:'desc'}],select:{latitude:true,longitude:true,capturedAt:true,user:{select:{name:true}}}}):Promise.resolve(null),
   visitUserIds.length?db.customerVisit.findMany({where:{companyId:user.companyId,branchId:branches.branchId,userId:{in:visitUserIds}},orderBy:[{checkedInAt:'desc'},{id:'desc'}],take:8,select:{id:true,contactName:true,checkedInAt:true,checkedOutAt:true,checkInAddress:true,checkInLatitude:true,checkInLongitude:true,checkoutSentiment:true,photo:{select:{id:true}},user:{select:{name:true}},customer:{select:{name:true}}}}):Promise.resolve([])
  ]);
  const latestLocation=point?{latitude:Number(point.latitude),longitude:Number(point.longitude),capturedAt:point.capturedAt,user:point.user}:null;
  return mobileJson({gpsTrackingEnabled:Boolean(company?.gpsTrackingEnabled),employees:checkInEmployees,liveUserId,latestLocation,checkUserId,recentVisits:recentVisits.map(visit=>({id:visit.id,userName:visit.user.name,contactName:visit.contactName,checkedInAt:visit.checkedInAt,checkedOutAt:visit.checkedOutAt,checkInAddress:visit.checkInAddress,checkInLatitude:Number(visit.checkInLatitude),checkInLongitude:Number(visit.checkInLongitude),checkoutSentiment:visit.checkoutSentiment,customerName:visit.customer?.name??null,thumbnailUrl:visit.photo?`api/v1/mobile/visit-photos/${visit.id}/thumbnail`:null}))});
 }catch(error){const expected=mobileUnauthorized(error)??mobileBranchFailure(error);if(expected)return expected;return mobileUnexpected('MOBILE_DASHBOARD',error)}
}
