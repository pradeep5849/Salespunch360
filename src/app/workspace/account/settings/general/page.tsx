import {AccountPageHeader} from "@/components/account/account-shell";
import {GeneralSettingsForm} from "@/components/account/general-settings-form";
import {getAccountSettings} from "@/lib/account/settings";
export default async function Page(){const settings=await getAccountSettings();return <div className="general-settings-page"><AccountPageHeader title="General" backHref="/workspace/account/settings"/><GeneralSettingsForm values={{appLanguage:settings?.appLanguage??"en",baseCurrency:settings?.baseCurrency??"INR",displayDecimalPlaces:settings?.displayDecimalPlaces??2,dateFormat:settings?.dateFormat??"DD/MM/YYYY",warnUnsavedChanges:settings?.warnUnsavedChanges??true,appearance:"STANDARD",fixedAssetsEnabled:settings?.enabledModules?.includes("ASSETS")??true}}/></div>}
