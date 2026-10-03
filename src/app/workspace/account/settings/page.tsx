import {AccountPageHeader} from "@/components/account/account-shell";import {AccountIcon} from "@/components/account/account-icons";
import {AccountSettingsMenu} from "@/components/account/account-settings-menu";
export default function Page(){return <><AccountPageHeader title="Settings" backHref="/workspace/account" action={<a className="account-settings-search-jump" href="#settings-search" aria-label="Search settings"><AccountIcon name="search"/></a>}/><main className="account-settings-index"><AccountSettingsMenu/></main></>}
