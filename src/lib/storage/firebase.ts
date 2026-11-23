import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { assertSafeObjectKey, StorageError, type PrivateStorage } from "./types";

const APP_NAME = "salespunch360-checkin-storage";

function firebaseApp(): App {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    throw new StorageError("PHOTO_STORAGE_NOT_CONFIGURED");
  }
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  }, APP_NAME);
}

export class FirebaseStorage implements PrivateStorage {
  private bucket() {
    return getStorage(firebaseApp()).bucket();
  }

  /** Read-only connectivity check; never returns credentials, bucket names, or raw provider errors. */
  async diagnose(): Promise<{ ok: boolean; category: string }> {
    try {
      await this.bucket().getMetadata();
      return { ok: true, category: "BUCKET_ACCESS_OK" };
    } catch (error) {
      const value = error as { code?: number | string; status?: number; message?: string };
      const code = Number(value.code ?? value.status);
      const message = String(value.message ?? "").toLowerCase();
      const category = code === 403 || message.includes("permission denied") ? "PERMISSION_DENIED"
        : code === 404 ? "BUCKET_NOT_FOUND"
        : code === 401 || message.includes("invalid_grant") || message.includes("invalid credential") ? "AUTHENTICATION_FAILED"
        : code === 429 ? "RATE_LIMITED"
        : code >= 500 ? "PROVIDER_UNAVAILABLE"
        : message.includes("photo_storage_not_configured") || message.includes("private key") || message.includes("credential") ? "CONFIGURATION_ERROR"
        : "UNKNOWN_FIREBASE_ERROR";
      return { ok: false, category };
    }
  }

  async exists(objectKey: string): Promise<boolean> {
    assertSafeObjectKey(objectKey);
    try {
      const [exists] = await this.bucket().file(objectKey).exists();
      return exists;
    } catch {
      throw new StorageError("PHOTO_STORAGE_UNAVAILABLE");
    }
  }

  async put(objectKey: string, data: Buffer): Promise<void> {
    assertSafeObjectKey(objectKey);
    try {
      await this.bucket().file(objectKey).save(data, {
        resumable: false,
        contentType: "image/webp",
        metadata: { cacheControl: "private, max-age=0" },
      });
    } catch {
      throw new StorageError("PHOTO_STORAGE_UNAVAILABLE");
    }
  }

  async get(objectKey: string): Promise<Buffer> {
    assertSafeObjectKey(objectKey);
    try {
      const [data] = await this.bucket().file(objectKey).download();
      return data;
    } catch {
      throw new StorageError("PHOTO_STORAGE_UNAVAILABLE");
    }
  }

  async delete(objectKey: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    try {
      await this.bucket().file(objectKey).delete({ ignoreNotFound: true });
    } catch {
      throw new StorageError("PHOTO_STORAGE_UNAVAILABLE");
    }
  }
}
