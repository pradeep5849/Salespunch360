import {AccountPageHeader} from "@/components/account/account-shell";
import {AccountSettingsMenu} from "@/components/account/account-settings-menu";

export default function Page(){
 return <>
  <AccountPageHeader title="Settings" backHref="/workspace/account"/>
  <main className="account-settings-index"><AccountSettingsMenu/></main>
 </>;
}
