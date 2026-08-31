import Link from "next/link";import {PasswordForm} from "./password-form";
export const metadata={title:"Change Password"};
export default function Page(){return <main className="employees-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link></header><section className="employees-content narrow-content"><p className="eyebrow">Account security</p><h1>Change Password</h1><p className="muted">Use at least 12 characters with uppercase, lowercase, and a number. A successful change signs out all sessions.</p><PasswordForm/></section></main>}
