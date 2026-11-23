/**
 * Copy existing check-in photos from Hostinger to Firebase without changing
 * database object keys or deleting source files.
 *
 * Run only in a controlled backend environment with DB access, the original
 * Hostinger storage mounted, and Firebase service account credentials.
 *
 * Default is read-only inventory. To copy: CHECKIN_MIGRATION_APPLY=true.
 * A failure exits nonzero; re-running is safe for matching objects.
 */
import { createHash } from "node:crypto";
import { db } from "../src/lib/db";
import { HostingerStorage } from "../src/lib/storage/hostinger";
import { FirebaseStorage } from "../src/lib/storage/firebase";

const apply = process.env.CHECKIN_MIGRATION_APPLY === "true";
const root = process.env.HOSTINGER_STORAGE_PATH ?? "";
const source = new HostingerStorage(root);
const destination = apply ? new FirebaseStorage() : undefined;
const batchSize = 100;
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

async function main() {
  let cursor: string | undefined;
  let photos = 0;
  let objects = 0;
  let copied = 0;
  let verified = 0;
  let failed = 0;
  do {
    const batch = await db.visitPhoto.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, objectKey: true, thumbnailObjectKey: true },
    });
    if (!batch.length) break;
    for (const photo of batch) {
      photos++;
      for (const key of [photo.objectKey, photo.thumbnailObjectKey]) {
        objects++;
        try {
          const original = await source.get(key);
          if (destination) {
            // If an object exists and differs, do not overwrite it silently.
            let existing: Buffer | undefined;
            try {
              existing = await destination.get(key);
            } catch {
              // Missing destination is expected during first migration.
            }
            if (existing && hash(existing) !== hash(original)) {
              throw new Error("DESTINATION_HASH_MISMATCH");
            }
            if (!existing) {
              await destination.put(key, original);
              copied++;
            }
            const actual = await destination.get(key);
            if (hash(actual) !== hash(original)) {
              throw new Error("VERIFICATION_HASH_MISMATCH");
            }
            verified++;
          }
        } catch (error) {
          failed++;
          console.error("Migration object failed", {
            photoId: photo.id,
            key,
            error: error instanceof Error ? error.message : "UNKNOWN",
          });
        }
      }
    }
    cursor = batch[batch.length - 1].id;
    if (batch.length < batchSize) break;
  } while (true);
  console.info(JSON.stringify({ mode: apply ? "copy-and-verify" : "inventory", photos, objects, copied, verified, failed }));
  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Migration failed", error instanceof Error ? error.message : "UNKNOWN");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
