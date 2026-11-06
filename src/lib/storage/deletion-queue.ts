import { db } from "@/lib/db";
import { privateStorage } from "@/lib/storage";
/** Company lock serializes recovery with irreversible file removal. Re-read the
 * queue entry under that lock: a restore may have cancelled it after selection. */
export async function retryPendingStorageDeletions(limit = 250) {
  const rows = await db.pendingStorageDeletion.findMany({
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let deleted = 0,
    failed = 0;
  for (const row of rows) {
    try {
      const removed = await db.$transaction(async (tx) => {
        const companyId =
          row.companyId ??
          /^companies\/([0-9a-f-]{36})\//i.exec(row.objectKey)?.[1];
        if (companyId)
          await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
        const current = await tx.pendingStorageDeletion.findUnique({
          where: { id: row.id },
        });
        if (!current) return false;
        await privateStorage().delete(current.objectKey);
        await tx.pendingStorageDeletion.deleteMany({ where: { id: row.id } });
        return true;
      });
      if (removed) deleted++;
    } catch (error) {
      const code =
        error instanceof Error &&
        ["PHOTO_STORAGE_NOT_CONFIGURED", "PHOTO_STORAGE_UNAVAILABLE"].includes(
          error.message,
        )
          ? error.message
          : "PHOTO_STORAGE_UNAVAILABLE";
      await db.pendingStorageDeletion.updateMany({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastError: code,
        },
      });
      failed++;
    }
  }
  return { processed: rows.length, deleted, failed };
}
