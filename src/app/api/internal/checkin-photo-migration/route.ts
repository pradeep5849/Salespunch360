import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../lib/db";
import { HostingerStorage } from "../../../../lib/storage/hostinger";
import { FirebaseStorage } from "../../../../lib/storage/firebase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const digest = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const unauthorized = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function POST(request: NextRequest) {
  // Off by default. Configure a separate long random token only during migration.
  const token = process.env.CHECKIN_MIGRATION_TOKEN;
  if (process.env.CHECKIN_MIGRATION_ENABLED !== "true" || !token || token.length < 32) {
    return unauthorized();
  }
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(a, b)) return unauthorized();

  let input: { cursor?: string; apply?: boolean };
  try {
    input = await request.json();
    if (!input || typeof input !== "object" || (input.cursor !== undefined && (typeof input.cursor !== "string" || input.cursor.length > 128)) || (input.apply !== undefined && typeof input.apply !== "boolean")) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const apply = input.apply === true;
  if (apply && process.env.CHECKIN_MIGRATION_APPLY !== "true") {
    return NextResponse.json({ error: "Copy mode disabled" }, { status: 403 });
  }
  try {
    const source = new HostingerStorage(process.env.HOSTINGER_STORAGE_PATH ?? "");
    const destination = apply ? new FirebaseStorage() : null;
    // Small, bounded batches avoid request timeouts. Caller supplies nextCursor to resume.
    const batch = await db.visitPhoto.findMany({
      orderBy: { id: "asc" },
      take: 10,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: { id: true, objectKey: true, thumbnailObjectKey: true },
    });
    const result = { mode: apply ? "copy-and-verify" : "inventory", photos: batch.length, objects: 0, copied: 0, verified: 0, failed: 0, failures: [] as Array<{ photoId: string; kind: string; reason: string }>, nextCursor: batch.length === 10 ? batch[batch.length - 1].id : null };
    for (const photo of batch) {
      for (const [kind, key] of [["original", photo.objectKey], ["thumbnail", photo.thumbnailObjectKey]] as const) {
        result.objects++;
        try {
          const original = await source.get(key);
          if (destination) {
            const exists = await destination.exists(key);
            const existing = exists ? await destination.get(key) : null;
            if (existing && digest(existing) !== digest(original)) throw new Error("DESTINATION_HASH_MISMATCH");
            if (!existing) {
              await destination.put(key, original);
              result.copied++;
            }
            if (digest(await destination.get(key)) !== digest(original)) throw new Error("VERIFICATION_HASH_MISMATCH");
            result.verified++;
          }
        } catch (error) {
          result.failed++;
          result.failures.push({ photoId: photo.id, kind, reason: error instanceof Error ? error.message : "UNKNOWN" });
        }
      }
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Migration service unavailable" }, { status: 503 });
  }
}
