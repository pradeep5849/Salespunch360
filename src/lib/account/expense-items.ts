import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { privateStorage } from "@/lib/storage";
import { requireAccountModules } from "./modules";
import { retrySerializable } from "./transaction-retry";
import type { ProjectActor } from "./projects";

export const expenseItemInput = z
  .object({
    name: z.string().trim().min(1).max(240),
    requestKey: z.string().uuid(),
  })
  .strict();
async function access(actor: ProjectActor, write = false) {
  if (
    !actor.companyId ||
    !actor.accountRole ||
    !ACCOUNT_ROLE_PERMISSIONS[actor.accountRole]?.includes(
      write ? "ACCOUNT_EXPENSE_ENTRY" : "ACCOUNT_EXPENSE_VIEW",
    )
  )
    throw new AuthorizationError();
  await requireAccountModules(actor, "EXPENSES");
  if (actor.accountRole === "PROJECT_MANAGER")
    await requireAccountModules(actor, "PROJECTS");
}
export async function expenseItemPhoto(file: File) {
  if (
    !file.type.startsWith("image/") ||
    file.size < 1 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("INVALID_EXPENSE_ITEM_PHOTO");
  try {
    return await sharp(Buffer.from(await file.arrayBuffer()), {
      failOn: "error",
      limitInputPixels: 20_000_000,
    })
      .rotate()
      .resize({
        width: 720,
        height: 720,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
  } catch {
    throw new Error("INVALID_EXPENSE_ITEM_PHOTO");
  }
}
function dto(item: {
  id: string;
  name: string;
  isActive: boolean;
  photoObjectKey: string | null;
}) {
  return {
    id: item.id,
    name: item.name,
    isActive: item.isActive,
    hasPhoto: !!item.photoObjectKey,
  };
}
export async function listExpenseItemsForActor(
  actor: ProjectActor,
  raw: unknown = {},
) {
  await access(actor);
  const query = z
    .object({
      q: z.string().trim().max(160).optional(),
      offset: z.coerce.number().int().min(0).max(10_000_000).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strict()
    .parse(raw);
  const where = {
    companyId: actor.companyId,
    isActive: true,
    ...(query.q
      ? { name: { contains: query.q, mode: "insensitive" as const } }
      : {}),
  };
  const [rows, total] = await db.$transaction(
    [
      db.expenseItem.findMany({
        where,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        skip: query.offset,
        take: query.limit,
      }),
      db.expenseItem.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return {
    rows: rows.map(dto),
    total,
    offset: query.offset,
    nextOffset:
      query.offset + rows.length < total ? query.offset + rows.length : null,
  };
}
export async function createExpenseItemForActor(
  actor: ProjectActor,
  raw: unknown,
  file?: File | null,
) {
  await access(actor, true);
  const input = expenseItemInput.parse(raw);
  const photo = file && file.size ? await expenseItemPhoto(file) : null;
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        name: input.name,
        photoHash: photo
          ? createHash("sha256").update(photo).digest("hex")
          : null,
      }),
    )
    .digest("hex");
  const prior = await db.expenseItem.findUnique({
    where: {
      companyId_creationRequestKey: {
        companyId: actor.companyId,
        creationRequestKey: input.requestKey,
      },
    },
  });
  if (prior) {
    if (prior.creationRequestHash !== hash)
      throw new Error("IDEMPOTENCY_KEY_REUSED");
    return dto(prior);
  }
  const key = photo
    ? `companies/${actor.companyId}/expense-items/${randomUUID()}/photo.webp`
    : null;
  if (key && photo) await privateStorage().put(key, photo);
  let usedPhoto = false;
  try {
    const result = await retrySerializable(() =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
          const existing = await tx.expenseItem.findUnique({
            where: {
              companyId_creationRequestKey: {
                companyId: actor.companyId,
                creationRequestKey: input.requestKey,
              },
            },
          });
          if (existing) {
            if (existing.creationRequestHash !== hash)
              throw new Error("IDEMPOTENCY_KEY_REUSED");
            return existing;
          }
          const normalizedName = z
            .string()
            .max(240)
            .parse(input.name.normalize("NFKC").toLowerCase());
          if (
            await tx.expenseItem.findUnique({
              where: {
                companyId_normalizedName: {
                  companyId: actor.companyId,
                  normalizedName,
                },
              },
            })
          )
            throw new Error("EXPENSE_ITEM_NAME_EXISTS");
          const item = await tx.expenseItem.create({
            data: {
              companyId: actor.companyId,
              name: input.name,
              normalizedName,
              creationRequestKey: input.requestKey,
              creationRequestHash: hash,
              photoObjectKey: key,
              photoMimeType: photo ? "image/webp" : null,
            },
          });
          await tx.accountOperationalAudit.create({
            data: {
              companyId: actor.companyId,
              actorUserId: actor.id,
              eventType: "EXPENSE_ITEM_CREATED",
              entityType: "EXPENSE_ITEM",
              entityId: item.id,
              metadata: { name: item.name, hasPhoto: !!photo },
            },
          });
          return item;
        },
        { isolationLevel: "Serializable" },
      ),
    );
    usedPhoto = result.photoObjectKey === key;
    return dto(result);
  } finally {
    if (key && !usedPhoto) {
      try {
        await privateStorage().delete(key);
      } catch {
        await db.pendingStorageDeletion.upsert({
          where: { objectKey: key },
          create: {
            companyId: actor.companyId,
            objectKey: key,
            lastError: "PHOTO_STORAGE_UNAVAILABLE",
          },
          update: {},
        });
      }
    }
  }
}
export async function expenseItemPhotoForActor(
  actor: ProjectActor,
  id: string,
) {
  await access(actor);
  const item = await db.expenseItem.findFirst({
    where: { companyId: actor.companyId, id: z.string().uuid().parse(id) },
  });
  if (!item?.photoObjectKey) throw new AuthorizationError();
  return privateStorage().get(item.photoObjectKey);
}
