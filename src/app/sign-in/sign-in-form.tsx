"use client";

import { useActionState, useState } from "react";
import { signIn, type SignInState } from "@/app/actions/auth";

const initialState: SignInState = {};

export function SignInForm() {
  const [showPassword,setShowPassword]=useState(false);
  const [state, formAction, pending] = useActionState(signIn, initialState);
  return (
    <form action={formAction} className="sign-in-form">
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      <label htmlFor="password">Password</label>
      <div className="password-field"><input id="password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" required /><button type="button" aria-label={showPassword?"Hide password":"Show password"} aria-pressed={showPassword} aria-controls="password" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"Hide":"Show"}</button></div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
