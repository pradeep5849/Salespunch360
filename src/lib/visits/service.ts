import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/authorization";
import { checkInSchema, checkoutSchema, fieldCheckInSchema, type CheckInInput, type CheckoutInput } from "./validation";
import { assertPendingVisitAllowed, customerReferenceDistanceMeters, repeatVisitSummary, resolveAttendanceId, VisitPolicyError } from "./policy";
import { evaluateGeofence } from "@/lib/geofence/policy";
import { assertOperationalWrite } from "@/lib/billing/entitlement";

async function requireFieldEmployee() {
  const user = await requireRole("MANAGER", "SALES");
  if (!user.companyId) throw new VisitPolicyError("VISIT_NOT_FOUND");
  return { ...user, companyId: user.companyId };
}

export async function checkIn(raw: CheckInInput) {
  const user = await requireFieldEmployee();
  return checkInForUser(user,raw);
}
export async function fieldCheckIn(raw:unknown){const user=await requireFieldEmployee();await assertOperationalWrite(user.companyId);const d=fieldCheckInSchema.parse(raw);return db.$transaction(async tx=>{
 await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${user.id}::uuid FOR UPDATE`;
 const employee=await tx.user.findFirst({where:{id:user.id,companyId:user.companyId,isActive:true,role:{in:["MANAGER","SALES"]}},select:{id:true}});if(!employee)throw new VisitPolicyError("VISIT_NOT_FOUND");
 const company=await tx.company.findUnique({where:{id:user.companyId},select:{attendanceEnabled:true,checkoutRequiredBeforeNextCheckIn:true}});if(!company)throw new VisitPolicyError("VISIT_NOT_FOUND");
 const attendance=await tx.attendance.findFirst({where:{companyId:user.companyId,userId:user.id,endedAt:null},select:{id:true}});const attendanceId=resolveAttendanceId(company.attendanceEnabled,attendance);
 const pending=await tx.customerVisit.count({where:{companyId:user.companyId,userId:user.id,checkedOutAt:null}});assertPendingVisitAllowed(company.checkoutRequiredBeforeNextCheckIn,pending);
 let customerId:string|undefined,leadId:string|undefined,name:string|undefined,phone:string|undefined;
 if(d.visitType==="FOLLOW_UP"){const lead=await tx.lead.findFirst({where:{id:d.leadId,companyId:user.companyId,assignedUserId:user.id},select:{id:true,customerId:true,contactName:true,title:true,phone:true}});if(!lead)throw new VisitPolicyError("VISIT_NOT_FOUND");leadId=lead.id;customerId=lead.customerId??(await tx.customer.create({data:{companyId:user.companyId,assignedUserId:user.id,name:lead.contactName??lead.title,phone:lead.phone}})).id;name=lead.contactName??lead.title;phone=lead.phone??undefined;}
 if(d.visitType==="CUSTOMER"){const customer=await tx.customer.findFirst({where:{id:d.customerId,companyId:user.companyId,assignedUserId:user.id},select:{id:true,name:true,phone:true}});if(!customer)throw new VisitPolicyError("CUSTOMER_NOT_FOUND");customerId=customer.id;name=customer.name;phone=customer.phone??undefined;}
 if(d.visitType==="NEW"){name=d.name;phone=d.phone;customerId=(await tx.customer.create({data:{companyId:user.companyId,assignedUserId:user.id,name,phone}})).id;if(phone){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.companyId+'|'+phone}))`;const existing=await tx.lead.findFirst({where:{companyId:user.companyId,phone:{equals:phone,mode:"insensitive"}},select:{id:true}});if(existing)leadId=existing.id;else{const lead=await tx.lead.create({data:{companyId:user.companyId,assignedUserId:user.id,createdByUserId:user.id,title:name,contactName:name,phone,source:"CUSTOMER_VISIT"}});leadId=lead.id;await tx.leadActivity.create({data:{companyId:user.companyId,leadId:lead.id,actorUserId:user.id,type:"CREATED",newAssignedUserId:user.id,toStage:"NEW"}});}}}
 if(!customerId)throw new VisitPolicyError("CUSTOMER_NOT_FOUND");
 const visit=await tx.customerVisit.create({data:{companyId:user.companyId,userId:user.id,customerId,leadId,attendanceId,visitType:d.visitType,contactName:name,contactPhone:phone,photoDataUrl:d.photoDataUrl,visitNotes:d.visitNotes,checkInLatitude:d.location.latitude,checkInLongitude:d.location.longitude,checkInAccuracyMeters:d.location.accuracyMeters}});
 if(d.visitType==="NEW"&&leadId)await tx.lead.updateMany({where:{id:leadId,companyId:user.companyId,sourceVisitId:null},data:{sourceVisitId:visit.id}});return visit;
 });}
export async function checkInForUser(user:{id:string;companyId:string},raw:unknown) {
  await assertOperationalWrite(user.companyId);
  const data = checkInSchema.parse(raw);
  const result=await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id" = ${user.companyId}::uuid FOR SHARE`;
    const employee = await tx.user.findFirst({ where: { id: user.id, companyId: user.companyId, isActive: true, role: { in: ["MANAGER", "SALES"] } }, select: { id: true } });
    if (!employee) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const [company, customer, attendance, pendingCount] = await Promise.all([
      tx.company.findFirst({ where: { id: user.companyId }, select: { attendanceEnabled: true, checkoutRequiredBeforeNextCheckIn: true,customerCheckInGeofenceEnabled:true,customerCheckInGeofenceRadiusMeters:true } }),
      tx.customer.findFirst({ where: { id: data.customerId, companyId: user.companyId }, select: { id: true, latitude: true, longitude: true } }),
      tx.attendance.findFirst({ where: { companyId: user.companyId, userId: user.id, endedAt: null }, select: { id: true } }),
      tx.customerVisit.count({ where: { companyId: user.companyId, userId: user.id, checkedOutAt: null } }),
    ]);
    if (!company || !customer) throw new VisitPolicyError("CUSTOMER_NOT_FOUND");
    const attendanceId = resolveAttendanceId(company.attendanceEnabled, attendance);
    assertPendingVisitAllowed(company.checkoutRequiredBeforeNextCheckIn, pendingCount);
    if(company.customerCheckInGeofenceEnabled){
      if(customer.latitude==null||customer.longitude==null||company.customerCheckInGeofenceRadiusMeters==null)throw new VisitPolicyError("CUSTOMER_LOCATION_REQUIRED");
      const verdict=evaluateGeofence(data.location,{latitude:customer.latitude,longitude:customer.longitude},company.customerCheckInGeofenceRadiusMeters);
      if(!verdict.allowed)return {blocked:{companyId:user.companyId,employeeId:user.id,type:verdict.type,action:"CUSTOMER_CHECK_IN" as const,customerId:customer.id,referenceLatitude:customer.latitude,referenceLongitude:customer.longitude,actualLatitude:data.location.latitude,actualLongitude:data.location.longitude,accuracyMeters:data.location.accuracyMeters,allowedRadiusMeters:company.customerCheckInGeofenceRadiusMeters,distanceMeters:verdict.distanceMeters}};
    }
    const previousVisitCount = await tx.customerVisit.count({ where: { companyId: user.companyId, customerId: customer.id } });
    const visit = await tx.customerVisit.create({ data: { companyId: user.companyId, userId: user.id, customerId: customer.id, attendanceId, checkedInAt: new Date(), checkInLatitude: data.location.latitude, checkInLongitude: data.location.longitude, checkInAccuracyMeters: data.location.accuracyMeters, visitNotes: data.visitNotes } });
    return { success:{ visit, ...repeatVisitSummary(previousVisitCount), customerReferenceDistanceMeters: customerReferenceDistanceMeters(customer, data.location) }};
  });
  if("blocked" in result&&result.blocked){const blocked=result.blocked;await db.geofenceEvent.create({data:blocked});throw new VisitPolicyError(blocked.type);}
  return result.success;
}

export async function checkout(raw: CheckoutInput) {
  const user = await requireFieldEmployee();
  return checkoutForUser(user,raw);
}
export async function checkoutForUser(user:{id:string;companyId:string},raw:unknown) {
  const data = checkoutSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const candidate = await tx.customerVisit.findFirst({ where: { id: data.visitId, companyId: user.companyId, userId: user.id, checkedOutAt: null }, select: { id: true } });
    if (!candidate) throw new VisitPolicyError("VISIT_NOT_FOUND");
    await tx.$queryRaw`SELECT "id" FROM "customer_visits" WHERE "id" = ${data.visitId}::uuid FOR UPDATE`;
    const employee = await tx.user.findFirst({ where: { id: user.id, companyId: user.companyId, isActive: true, role: { in: ["MANAGER", "SALES"] } }, select: { id: true } });
    if (!employee) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const visit = await tx.customerVisit.findFirst({ where: { id: data.visitId, companyId: user.companyId, userId: user.id, checkedOutAt: null }, select: { id: true } });
    if (!visit) throw new VisitPolicyError("VISIT_NOT_FOUND");
    const updated = await tx.customerVisit.updateMany({ where: { id: visit.id, companyId: user.companyId, userId: user.id, checkedOutAt: null }, data: { checkedOutAt: new Date(), checkOutLatitude: data.location.latitude, checkOutLongitude: data.location.longitude, checkOutAccuracyMeters: data.location.accuracyMeters, checkoutSentiment: data.sentiment, checkoutRemarks: data.remarks } });
    if (updated.count !== 1) throw new VisitPolicyError("VISIT_NOT_FOUND");
  });
}

export async function getOwnPendingVisits() {
  const user = await requireFieldEmployee();
  return db.customerVisit.findMany({ where: { companyId: user.companyId, userId: user.id, checkedOutAt: null }, include: { customer: true }, orderBy: { checkedInAt: "desc" } });
}
export async function getOwnVisitHistoryForUser(user:{id:string;companyId:string}) {
  return db.customerVisit.findMany({ where: { companyId: user.companyId, userId: user.id }, select:{id:true,checkedInAt:true,checkedOutAt:true,visitNotes:true,checkoutSentiment:true,checkoutRemarks:true,_count:{select:{sourceLeads:true}},customer:{select:{id:true,name:true,contactPerson:true,address:true,phone:true}}}, orderBy: { checkedInAt: "desc" },take:50 });
}

export async function getVisibleRecentVisits() {
  const viewer = await requireRole("COMPANY_ADMIN", "MANAGER");
  if (!viewer.companyId) throw new VisitPolicyError("VISIT_NOT_FOUND");
  return db.customerVisit.findMany({ where: { companyId: viewer.companyId, ...(viewer.role === "MANAGER" ? { OR: [{ userId: viewer.id }, { user: { managerId: viewer.id, role: "SALES" } }] } : {}) }, include: { customer: { select: { name: true } }, user: { select: { name: true, role: true } } }, orderBy: { checkedInAt: "desc" }, take: 50 });
}
