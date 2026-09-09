/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useEffect, useState } from "react";
import { register, type RegistrationState } from "@/app/actions/register";

const initialState: RegistrationState = {};
function FieldError({ errors }: { errors?: string[] }) { return errors?.length ? <span className="field-error">{errors[0]}</span> : null; }
function PasswordIcon({ visible }: { visible: boolean }) { return visible ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.7a2 2 0 002.7 2.7M9.9 4.2A10.8 10.8 0 0112 4c5.5 0 9 5 9 5a16.8 16.8 0 01-2.1 2.5M6.2 6.2C4.2 7.5 3 9 3 9s3.5 5 9 5c1 0 2-.2 2.8-.5" /></svg> : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5z" /><circle cx="12" cy="12" r="2.5" /></svg>; }

export function RegistrationForm() {
  const [state, formAction, pending] = useActionState(register, initialState);
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [showConfirmation, setShowConfirmation] = useState(false);
  const [logoPreview,setLogoPreview]=useState<string>(); useEffect(()=>()=>{if(logoPreview)URL.revokeObjectURL(logoPreview)},[logoPreview]);
  const [productEdition,setProductEdition]=useState("");
  const confirmationEntered = confirmation.length > 0; const passwordsMatch = confirmationEntered && password === confirmation;
  return <form action={formAction} className="registration-form">
    <input type="hidden" name="productEdition" value={productEdition} />
    <div className="form-section"><div className="section-heading"><span>1</span><div><h2>Choose product</h2><p>Select one edition for your Company.</p></div></div><div className="product-grid" role="radiogroup" aria-label="Product edition">{[["SALESPUNCH360","SalesPunch360","Field Sales & CRM"],["SALESPUNCH360_ACCOUNT","SalesPunch360 Account","Accounts & Business Management"],["SALESPUNCH360_PLUS","SalesPunch360 Plus","Sales + Accounts"]].map(([value,title,description])=><button key={value} className={`product-card ${productEdition===value?"selected":""}`} type="button" role="radio" aria-checked={productEdition===value} onClick={()=>setProductEdition(value)}><strong>{title}</strong><span>{description}</span></button>)}</div><FieldError errors={state.fieldErrors?.productEdition}/></div>
    <div className="form-section"><div className="section-heading"><span>2</span><div><h2>Company information</h2><p>Identify your team workspace.</p></div></div><div className="field-grid"><div className="field full"><label htmlFor="companyName">Company name</label><input id="companyName" name="companyName" required maxLength={120} autoComplete="organization" placeholder="Acme Sales" /><FieldError errors={state.fieldErrors?.companyName} /></div></div></div>
    <div className="form-section"><div className="section-heading"><span>3</span><div><h2>Administrator information</h2><p>This account will manage your company. Business, branch, and module details are completed after email verification.</p></div></div><div className="field-grid">
      <div className="field full"><label htmlFor="companyLogo">Company Logo (optional)</label><input id="companyLogo" name="companyLogo" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];setLogoPreview(file?URL.createObjectURL(file):undefined)}}/><small>JPEG, PNG, or WebP. Maximum 5 MB.</small>{logoPreview&&<img className="company-logo-preview" src={logoPreview} alt="Company logo preview"/>}</div>
      <div className="field full"><label htmlFor="adminName">Full name</label><input id="adminName" name="adminName" required maxLength={120} autoComplete="name" placeholder="Alex Morgan" /><FieldError errors={state.fieldErrors?.adminName} /></div>
      <div className="field full"><label htmlFor="adminEmail">Email address</label><input id="adminEmail" name="adminEmail" type="email" required autoComplete="email" placeholder="alex@company.com" /><FieldError errors={state.fieldErrors?.adminEmail} /></div>
      <div className="field"><label htmlFor="adminPassword">Password</label><div className="password-field"><input id="adminPassword" name="adminPassword" type={showPassword ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><PasswordIcon visible={showPassword} /></button></div><FieldError errors={state.fieldErrors?.adminPassword} /></div>
      <div className="field"><label htmlFor="confirmPassword">Confirm password</label><div className="password-field"><input id="confirmPassword" name="confirmPassword" type={showConfirmation ? "text" : "password"} required minLength={12} maxLength={200} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /><button type="button" aria-label={showConfirmation ? "Hide confirmed password" : "Show confirmed password"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(value => !value)}><PasswordIcon visible={showConfirmation} /></button></div>{confirmationEntered&&<span className={passwordsMatch?"password-match":"field-error"} role="status">{passwordsMatch?"✓ Passwords match":"Passwords do not match"}</span>}<FieldError errors={state.fieldErrors?.confirmPassword} /></div>
    </div></div>
    <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>{state.error&&<p className="form-error" role="alert">{state.error}</p>}<button className="register-button" type="submit" disabled={pending}>{pending?"Creating workspace…":"Start my free trial"}</button><p className="terms">By continuing, you agree to use SalesPunch360 responsibly.</p>
  </form>;
}
