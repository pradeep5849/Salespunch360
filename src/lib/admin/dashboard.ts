import { Prisma, type SubscriptionStatus } from "@prisma/client";
import { requireGlobalSuperAdmin } from "@/lib/auth/authorization";
import { db } from "@/lib/db";

const companyIdentitySelect = { id: true, name: true, productEdition: true, subscriptionStatus: true, trialEndsAt: true, createdAt: true } as const;

export async function getAdminDashboard() {
  await requireGlobalSuperAdmin();
  const [groupedStatuses, recentCompanies, pendingOrders, capturedPayments, legacyTelecaller, activeUsers] = await Promise.all([
    db.company.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
    db.company.findMany({ select: companyIdentitySelect, orderBy: { createdAt: "desc" }, take: 8 }),
    db.billingOrder.count({where:{status:"PENDING"}}),
    db.paymentTransaction.aggregate({where:{status:"CAPTURED"},_count:{_all:true},_sum:{amount:true}}),
    db.$queryRaw<{pending:bigint;captured:bigint;revenue:Prisma.Decimal}[]>(Prisma.sql`SELECT COUNT(*) FILTER (WHERE status='PENDING')::bigint AS pending,COUNT(*) FILTER (WHERE status='PAID')::bigint AS captured,COALESCE(SUM("totalAmount") FILTER (WHERE status='PAID'),0)::numeric AS revenue FROM "telecaller_billing_orders"`),
    db.user.count({where:{isActive:true,companyId:{not:null}}}),
  ]);
  const counts: Record<SubscriptionStatus, number> = { TRIAL: 0, ACTIVE: 0, EXPIRED: 0, SUSPENDED: 0 };
  for (const row of groupedStatuses) counts[row.subscriptionStatus] = row._count._all;
  const tele=legacyTelecaller[0];
  return { counts: { total: Object.values(counts).reduce((sum, count) => sum + count, 0), ...counts }, billing:{pendingOrders:pendingOrders+Number(tele?.pending??0),capturedPayments:capturedPayments._count._all+Number(tele?.captured??0),capturedRevenue:Number(capturedPayments._sum.amount??0)+Number(tele?.revenue??0),activeUsers}, recentCompanies };
}

export async function getAdminCompanies() {
  await requireGlobalSuperAdmin();
  return db.company.findMany({
    select: { ...companyIdentitySelect, _count: { select: { users: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

export async function getAdminCompany(companyId:string){await requireGlobalSuperAdmin();return db.company.findUnique({where:{id:companyId},select:{id:true,name:true,slug:true,productEdition:true,subscriptionStatus:true,trialStartedAt:true,trialEndsAt:true,teamStructure:true,createdAt:true,users:{where:{isActive:true},select:{id:true,name:true,email:true,role:true,salesRole:true,accountRole:true,salesAccessActive:true,accountAccessActive:true},orderBy:{name:"asc"}},subscriptions:{orderBy:{endsAt:"desc"},take:10,select:{id:true,status:true,billingPeriod:true,adminSeats:true,managerSeats:true,salesSeats:true,startsAt:true,endsAt:true,sourceOrder:{select:{provider:true}}}},billingOrders:{orderBy:{createdAt:"desc"},take:10,select:{id:true,status:true,billingPeriod:true,adminSeats:true,managerSeats:true,salesSeats:true,totalAmount:true,currency:true,provider:true,createdAt:true}}}})}
