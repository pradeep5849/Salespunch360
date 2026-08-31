import Link from "next/link";
import { getCompanyProfile } from "@/lib/company/profile";
import { ProfileForm } from "./profile-form";
export const metadata={title:"Company profile"};
export default async function CompanyProfilePage(){const profile=await getCompanyProfile();return <main className="employees-shell"><header className="employees-header"><Link href="/workspace">← Workspace</Link><div className="logo"><span>SP</span> SalesPunch360</div></header><section className="employees-content"><p className="eyebrow">Company settings</p><h1>Company profile</h1><p className="muted">Complete the required business details to unlock employee creation. Tenant IDs and your company slug cannot be edited.</p><ProfileForm profile={profile as unknown as Record<string,string|null>}/></section></main>}
