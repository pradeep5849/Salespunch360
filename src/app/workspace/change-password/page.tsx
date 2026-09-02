import {WorkspacePageHeader} from "@/components/workspace/workspace-page-header";import {PasswordForm} from "./password-form";
export const metadata={title:"Change Password"};
export default function Page(){return <main className="employees-shell"><section className="employees-content narrow-content"><WorkspacePageHeader title="Change Password" backHref="/workspace"/><p className="muted">Use at least 12 characters with uppercase, lowercase, and a number. A successful change signs out all sessions.</p><PasswordForm/></section></main>}
