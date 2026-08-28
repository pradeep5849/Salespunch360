"use client";

import { useActionState } from "react";
import { register, type RegistrationState } from "@/app/actions/register";

const initialState: RegistrationState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <span className="field-error">{errors[0]}</span>;
}

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  return (
    <form action={formAction} className="registration-form">
      <div className="form-section">
        <div className="section-heading"><span>1</span><div><h2>Company information</h2><p>Identify your team workspace.</p></div></div>
        <div className="field-grid">
          <div className="field full"><label htmlFor="companyName">Company name</label><input id="companyName" name="companyName" required maxLength={120} autoComplete="organization" placeholder="Acme Sales" /><FieldError errors={state.fieldErrors?.companyName} /></div>
          <div className="field full"><label htmlFor="companySlug">Company slug</label><div className="slug-input"><span>salespunch360.com/</span><input id="companySlug" name="companySlug" required maxLength={63} autoCapitalize="none" spellCheck={false} placeholder="acme-sales" /></div><small>Lowercase letters, numbers, and hyphens.</small><FieldError errors={state.fieldErrors?.companySlug} /></div>
        </div>
      </div>
      <div className="form-section">
        <div className="section-heading"><span>2</span><div><h2>Administrator information</h2><p>This account will manage your company.</p></div></div>
        <div className="field-grid">
          <div className="field full"><label htmlFor="adminName">Full name</label><input id="adminName" name="adminName" required maxLength={120} autoComplete="name" placeholder="Alex Morgan" /><FieldError errors={state.fieldErrors?.adminName} /></div>
          <div className="field full"><label htmlFor="adminEmail">Email address</label><input id="adminEmail" name="adminEmail" type="email" required autoComplete="email" placeholder="alex@company.com" /><FieldError errors={state.fieldErrors?.adminEmail} /></div>
          <div className="field"><label htmlFor="adminPassword">Password</label><input id="adminPassword" name="adminPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /><FieldError errors={state.fieldErrors?.adminPassword} /></div>
          <div className="field"><label htmlFor="confirmPassword">Confirm password</label><input id="confirmPassword" name="confirmPassword" type="password" required minLength={12} maxLength={200} autoComplete="new-password" /><FieldError errors={state.fieldErrors?.confirmPassword} /></div>
        </div>
      </div>
      <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="register-button" type="submit" disabled={pending}>{pending ? "Creating workspace…" : "Start my free trial"}</button>
      <p className="terms">By continuing, you agree to use SalesPunch360 responsibly.</p>
    </form>
  );
}
