import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { getCompanyProfile } from "@/lib/company/profile";
import { ProfileForm } from "./profile-form";
export const metadata={title:"Company Details"};
export default async function CompanyProfilePage(){const {profile,editable}=await getCompanyProfile();return <main className="employees-shell"><section className="employees-content"><WorkspacePageHeader title="Company Details" backHref="/workspace"/><p className="muted">{editable?"Complete the required business details to unlock employee creation.":"Your company’s authoritative business details (view only)."} Tenant IDs and the company slug are never exposed here.</p><ProfileForm profile={profile as unknown as Record<string,string|null>} editable={editable}/></section></main>}
