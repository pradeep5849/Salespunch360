'use server';
import {after} from 'next/server';
import {revalidatePath} from 'next/cache';
import {mutationGuard} from '@/lib/security/request';
import {deleteOwnVisit,VisitDeletionError} from '@/lib/visits/deletion';
import {retryPendingStorageDeletions} from '@/lib/storage/deletion-queue';
export async function deleteOwnVisitAction(input:{visitId:string;revision:string;confirmed:true}){
 await mutationGuard('visit-deletion',20);
 try{await deleteOwnVisit(input)}catch(error){return{ok:false,error:error instanceof VisitDeletionError?error.code:'DELETE_NOT_CONFIRMED'}}
 revalidatePath('/workspace/reports/check-ins');revalidatePath('/workspace/check-ins');
 after(async()=>{try{await retryPendingStorageDeletions()}catch{/* Persisted queue retries through scheduled cleanup. */}});
 return{ok:true};
}
