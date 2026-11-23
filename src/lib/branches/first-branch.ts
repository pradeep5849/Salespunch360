import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  canAccessSalesWorkspace,
  canAccessAccountWorkspace,
} from "@/lib/auth/workspace-policy";
import { branchDetails } from "./details";
export class BranchSetupError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "FIRST_BRANCH_CHOICE_REQUIRED"
      | "FIRST_BRANCH_SETUP_CHANGED"
      | "BRANCH_SETUP_INVALID"
      | "DUPLICATE_BRANCH_CODE",
  ) {
    super(code);
  }
}
export const branchCreationSchema = branchDetails
  .extend({
    firstBranchAction: z.enum(["KEEP_HEAD_OFFICE", "MOVE_EXISTING"]).optional(),
  })
  .strict();
/** Retain existing record IDs and immutable branch links. Moving the initial business
 * assigns its current branch identity to the requested branch and creates an empty Head Office. */
export async function createBranchForOwner(
  actor: { id: string; companyId: string },
  raw: unknown,
) {
  const { firstBranchAction, ...details } = branchCreationSchema.parse(raw);
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid AND "companyId"=${actor.companyId}::uuid FOR SHARE`;
      const [company, user] = await Promise.all([
        tx.company.findUnique({
          where: { id: actor.companyId },
          select: { productEdition: true },
        }),
        tx.user.findFirst({
          where: {
            id: actor.id,
            companyId: actor.companyId,
            isActive: true,
            salesRole: "PRIMARY_ADMIN",
          },
          select: {
            companyId: true,
            role: true,
            isActive: true,
            salesRole: true,
            accountRole: true,
            salesAccessActive: true,
            accountAccessActive: true,
            managerType: true,
          },
        }),
      ]);
      if (
        !company ||
        !user ||
        (!canAccessSalesWorkspace(user, company.productEdition) &&
          !canAccessAccountWorkspace(user, company.productEdition))
      )
        throw new BranchSetupError("FORBIDDEN");
      const branches = await tx.branch.findMany({
          where: { companyId: actor.companyId },
          orderBy: { id: "asc" },
        }),
        primary = branches.find((row) => row.isPrimary);
      if (!primary || !primary.isActive)
        throw new BranchSetupError("BRANCH_SETUP_INVALID");
      const first = branches.length === 1;
      if (first && !firstBranchAction)
        throw new BranchSetupError("FIRST_BRANCH_CHOICE_REQUIRED");
      if (!first && firstBranchAction)
        throw new BranchSetupError("FIRST_BRANCH_SETUP_CHANGED");
      let created,
        headOfficeId = primary.id;
      if (firstBranchAction === "MOVE_EXISTING") {
        if (details.code === primary.code)
          throw new BranchSetupError("DUPLICATE_BRANCH_CODE");
        created = await tx.branch.update({
          where: { id: primary.id },
          data: { ...details, isPrimary: false },
        });
        const headOffice = await tx.branch.create({
          data: {
            companyId: actor.companyId,
            name: "Head Office",
            code: primary.code,
            isPrimary: true,
            isActive: true,
            addressLine1: primary.addressLine1,
            addressLine2: primary.addressLine2,
            locality: primary.locality,
            city: primary.city,
            state: primary.state,
            postalCode: primary.postalCode,
            country: primary.country,
            phone: primary.phone,
            email: primary.email,
            gstin: primary.gstin,
            gstStateCode: primary.gstStateCode,
            gstRegistrationType: primary.gstRegistrationType,
          },
        });
        headOfficeId = headOffice.id;
      } else
        created = await tx.branch.create({
          data: { ...details, companyId: actor.companyId, isPrimary: false },
        });
      await tx.accountOperationalAudit.create({
        data: {
          companyId: actor.companyId,
          actorUserId: actor.id,
          eventType: first
            ? "FIRST_ADDITIONAL_BRANCH_CREATED"
            : "BRANCH_CREATED",
          entityType: "BRANCH",
          entityId: created.id,
          metadata: {
            firstBranchAction: firstBranchAction ?? null,
            previousHeadOfficeId: primary.id,
            headOfficeId,
            branchId: created.id,
            recordIdsPreserved: true,
          },
        },
      });
      return created;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new BranchSetupError("DUPLICATE_BRANCH_CODE");
    throw error;
  }
}
