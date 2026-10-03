import {AccountPageHeader} from "@/components/account/account-shell";
import {AccountSettingsMenu} from "@/components/account/account-settings-menu";

export default function Page(){
 return <>
  <AccountPageHeader title="Settings" backHref="/workspace/account" compact/>
  <main className="account-settings-index" style={{gap:0}}><AccountSettingsMenu/></main>
 </>;
}
