"use client";

import {useActionState} from "react";
import {addPhoneToVisitFormAction,type VisitActionResult} from "@/app/actions/visits";

const initialState:VisitActionResult={ok:false};

export function PendingPhoneForm({visitId}:{visitId:string}){
 const[state,action,pending]=useActionState(addPhoneToVisitFormAction,initialState);
 return <form action={action}><input type="hidden" name="visitId" value={visitId}/><input name="phone" required inputMode="tel" placeholder="Add phone to create Lead" disabled={pending}/><button disabled={pending}>{pending?"Adding…":"Add phone"}</button>{state.error&&<p className="form-error" role="alert">{state.error}</p>}{state.ok&&<p className="form-success" role="status">Phone added. Creating Lead…</p>}</form>;
}
