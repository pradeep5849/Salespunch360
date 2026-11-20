'use client';
import {useActionState} from 'react';
import {followUpTaskFeedback} from '@/app/actions/follow-up-tasks';
export function TaskActionForm({taskId,kind}:{taskId:string;kind:'CALL'|'CANCEL'}){
 const [state,action,pending]=useActionState(followUpTaskFeedback,{});
 return <form action={action} className={kind==='CALL'?'call-outcome-form':undefined} onSubmit={event=>{if(kind==='CANCEL'&&!window.confirm('Cancel this follow-up? It will remain in Cancelled history.'))event.preventDefault();}}>
  <input type="hidden" name="taskId" value={taskId}/><input type="hidden" name="operation" value={kind}/>
  {kind==='CALL'&&<textarea name="outcomeNote" required maxLength={1000} placeholder="Add call outcome note" disabled={pending}/>}
  {state.error&&<p role="alert" className="form-error">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}
  <button disabled={pending}>{pending?'Saving…':kind==='CALL'?'Complete Call':'Cancel'}</button>
 </form>;
}
