import {AccountPageHeader} from "@/components/account/account-shell";
import {AccountSettingsMenu} from "@/components/account/account-settings-menu";
export default function Page(){return <><AccountPageHeader title="Settings" subtitle="Account configuration" backHref="/workspace/account"/><main className="account-settings-index"><AccountSettingsMenu/></main></>}
