export interface PrivateStorage { put(objectKey:string,data:Buffer):Promise<void>; get(objectKey:string):Promise<Buffer>; delete(objectKey:string):Promise<void> }
export class StorageError extends Error{constructor(public code:"PHOTO_STORAGE_NOT_CONFIGURED"|"PHOTO_STORAGE_UNAVAILABLE"){super(code)}}
export function assertSafeObjectKey(key:string){if(!key||key.startsWith("/")||key.includes("\\")||key.split("/").some(x=>x===""||x==="."||x===".."))throw new Error("INVALID_STORAGE_KEY");return key;}
