import Link from "next/link";
import {isVerificationTokenShape}from"@/lib/auth/email-verification";
import {ConfirmationForm}from"./confirmation-form";
export const metadata={title:"Verify email"};
export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{token?:string}>}){const token=(await searchParams).token??"";return <main className="verification-shell"><section className="verification-card"><div className="logo"><span>SP</span> SalesPunch360</div><h1>Verify your email</h1><ConfirmationForm token={token} validShape={isVerificationTokenShape(token)}/><Link className="primary-link" href="/workspace">Continue to workspace</Link></section></main>}
