"use client";
import{useActionState}from"react";
import{resendVerificationEmail,type VerificationActionState}from"@/app/actions/email-verification";
export function VerificationResend(){const[state,action,pending]=useActionState(resendVerificationEmail,{} as VerificationActionState);return <form action={action}><button className="primary-button" disabled={pending}>{pending?"Sending…":"Resend verification email"}</button>{state.message&&<small className={state.status==="error"?"form-error":"form-success"}>{state.message}</small>}</form>}
