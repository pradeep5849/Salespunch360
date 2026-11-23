import { FirebaseStorage } from "./firebase";
import { HostingerStorage } from "./hostinger";
import { StorageError, type PrivateStorage } from "./types";

let instance: PrivateStorage | undefined;

export function privateStorage(): PrivateStorage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER ?? "hostinger";
  if (driver === "hostinger") {
    return (instance = new HostingerStorage(process.env.HOSTINGER_STORAGE_PATH ?? ""));
  }
  if (driver === "firebase") {
    return (instance = new FirebaseStorage());
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
