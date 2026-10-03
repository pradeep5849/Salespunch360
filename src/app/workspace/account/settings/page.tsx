import {AccountPageHeader} from "@/components/account/account-shell";
import {AccountSettingsMenu} from "@/components/account/account-settings-menu";
export default function Page(){return <main className="account-inner-page settings-index-page"><AccountPageHeader title="Settings" backHref="/workspace/account"/><div className="account-settings-index"><AccountSettingsMenu/></div></main>}
