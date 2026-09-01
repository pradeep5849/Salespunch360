import{HostingerStorage}from"./hostinger";import{StorageError,type PrivateStorage}from"./types";
let instance:PrivateStorage|undefined;export function privateStorage(){if(instance)return instance;if((process.env.STORAGE_DRIVER??"hostinger")!=="hostinger")throw new StorageError("PHOTO_STORAGE_NOT_CONFIGURED");return instance=new HostingerStorage(process.env.HOSTINGER_STORAGE_PATH??"");}
export function setPrivateStorageForTests(value:PrivateStorage|undefined){instance=value;}
export function visitPhotoKeys(companyId:string,userId:string,visitId:string){const base=`companies/${companyId}/employees/${userId}/check-ins/${visitId}`;return{objectKey:`${base}/photo.webp`,thumbnailObjectKey:`${base}/thumb.webp`};}
