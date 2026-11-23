import { FirebaseStorage } from "./firebase";
import { HostingerStorage } from "./hostinger";
import { assertSafeObjectKey, StorageError, type PrivateStorage } from "./types";

let instance: PrivateStorage | undefined;

/**
 * New check-in photos are written to Firebase. Existing photos remain readable
 * from Hostinger without requiring a bulk migration.
 *
 * A failed read from Hostinger is retried in Firebase; neither backend is
 * exposed directly to callers. Deletion attempts both backends so retention
 * jobs do not leave old Hostinger photos behind.
 */
export class FirebaseWithHostingerLegacyStorage implements PrivateStorage {
  constructor(
    private readonly firebase: PrivateStorage,
    private readonly hostinger: PrivateStorage,
  ) {}

  put(objectKey: string, data: Buffer): Promise<void> {
    assertSafeObjectKey(objectKey);
    return this.firebase.put(objectKey, data);
  }

  async get(objectKey: string): Promise<Buffer> {
    assertSafeObjectKey(objectKey);
    try {
      return await this.hostinger.get(objectKey);
    } catch {
      return this.firebase.get(objectKey);
    }
  }

  async delete(objectKey: string): Promise<void> {
    assertSafeObjectKey(objectKey);
    const results = await Promise.allSettled([
      this.firebase.delete(objectKey),
      this.hostinger.delete(objectKey),
    ]);
    if (results.some((result) => result.status === "rejected")) {
      throw new StorageError("PHOTO_STORAGE_UNAVAILABLE");
    }
  }
}

export function privateStorage(): PrivateStorage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "hostinger";
  if (driver === "hostinger") {
    return (instance = new HostingerStorage(process.env.HOSTINGER_STORAGE_PATH ?? ""));
  }
  if (driver === "firebase") {
    const firebase = new FirebaseStorage();
    const legacyPath = process.env.HOSTINGER_STORAGE_PATH;
    return (instance = legacyPath
      ? new FirebaseWithHostingerLegacyStorage(firebase, new HostingerStorage(legacyPath))
      : firebase);
  }
  throw new StorageError("PHOTO_STORAGE_NOT_CONFIGURED");
}

export function setPrivateStorageForTests(value: PrivateStorage | undefined) {
  instance = value;
}

export function visitPhotoKeys(companyId: string, userId: string, visitId: string) {
  const base = `companies/${companyId}/employees/${userId}/check-ins/${visitId}`;
  return {
    objectKey: `${base}/photo.webp`,
    thumbnailObjectKey: `${base}/thumb.webp`,
  };
}
