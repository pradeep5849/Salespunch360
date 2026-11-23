'use client';
import {useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {deleteOwnVisitAction} from '@/app/actions/visit-deletion';
export function DeleteOwnVisit({visitId,revision}:{visitId:string;revision:string}){
 const router=useRouter(),[confirm,setConfirm]=useState(false),[pending,start]=useTransition(),[error,setError]=useState('');
 if(error)return <div role="alert">{error}<button type="button" onClick={()=>{setConfirm(false);setError('');router.refresh()}}>Reload check-ins</button></div>;
 if(!confirm)return <button type="button" onClick={()=>setConfirm(true)}>Delete</button>;
 return <div role="group" aria-label="Confirm check-in deletion"><p>Delete this mistaken check-in and its photo? This cannot be undone. Linked visits cannot be deleted. Attendance and travel remain unchanged.</p><button type="button" disabled={pending} onClick={()=>start(async()=>{try{const r=await deleteOwnVisitAction({visitId,revision,confirmed:true});if(!r.ok){setError(r.error==='VISIT_LINKED'?'This visit is linked to a lead, customer or follow-up and cannot be deleted.':'Deletion was not confirmed. Reload the current check-ins before trying again.');return}router.refresh()}catch{setError('Deletion was not confirmed. Reload the current check-ins before trying again.')}})}>{pending?'Deleting…':'Delete check-in'}</button><button type="button" disabled={pending} onClick={()=>setConfirm(false)}>Cancel</button></div>;
}
