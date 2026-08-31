"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";

const initialState: SignInState = {};

function PasswordIcon({ visible }: { visible: boolean }) {
  return visible
    ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 2-.2 2.8-.5" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

export function SignInForm() {
  const [showPassword,setShowPassword]=useState(false);
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="sign-in-form">
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="Email" />
      <label htmlFor="password">Password</label>
      <div className="password-field"><input id="password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" required placeholder="Password" /><button type="button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} aria-controls="password" onClick={()=>setShowPassword(v=>!v)}><PasswordIcon visible={showPassword}/></button></div>
      <label className="remember-me"><input name="remember" type="checkbox" value="true" /> <span>Remember me</span></label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}
