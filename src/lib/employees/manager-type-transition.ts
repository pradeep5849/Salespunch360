import type { Prisma } from "@prisma/client";

/** One authoritative personal-obligation guard for every identity entering Office Manager. */
export async function assertManagerOnlyTransitionSafe(tx: Prisma.TransactionClient, companyId: string, userId: string) {
  const [attendance, visit, lead, task, customer, target] = await Promise.all([
    tx.attendance.findFirst({ where: { companyId, userId, endedAt: null }, select: { id: true } }),
    tx.customerVisit.findFirst({ where: { companyId, userId, checkedOutAt: null }, select: { id: true } }),
    tx.lead.findFirst({ where: { companyId, assignedUserId: userId, stage: { in: ["NEW", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] } }, select: { id: true } }),
    tx.followUpTask.findFirst({ where: { companyId, assignedUserId: userId, status: "PENDING" }, select: { id: true } }),
    tx.customer.findFirst({ where: { companyId, assignedUserId: userId }, select: { id: true } }),
    tx.salesTarget.findFirst({ where: { companyId, assignedUserId: userId, endDate: { gte: new Date() } }, select: { id: true } }),
  ]);
  if (attendance || visit || lead || task || customer || target) throw new Error("MANAGER_TYPE_CONFLICT");
}

export async function assertLeavingManagerSafe(tx: Prisma.TransactionClient, companyId: string, userId: string) {
  const assignedUser=await tx.user.findFirst({where:{companyId,managerId:userId,salesRole:"SALES"},select:{id:true}});
  if(assignedUser)throw new Error("MANAGER_ASSIGNMENT_CONFLICT");
}
