"use client";
import {useActionState} from 'react';
import {SaveSubmitButton} from '@/components/account/save-feedback';
type State={error?:string;success?:string;fieldErrors?:Record<string,string[]>};
export function EmployeeFeedbackForm({action,children,className}:{action:(state:State,form:FormData)=>Promise<State>;children:React.ReactNode;className?:string}){
 const [state,submit]=useActionState(action,{});
 return <form action={submit} className={className} onReset={event=>event.preventDefault()}>{state.error&&<p className="form-error" role="alert">{state.error}</p>}{state.fieldErrors&&<ul className="form-error">{Object.entries(state.fieldErrors).flatMap(([field,errors])=>errors.map((error,index)=><li key={`${field}-${index}`}>{field}: {error}</li>))}</ul>}{state.success&&<p className="form-success" role="status">{state.success}</p>}{children}</form>;
}
export {SaveSubmitButton};
