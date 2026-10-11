import {ModuleSettingsForm} from "@/components/account/module-settings-form";
import {getModuleSettings} from "@/lib/account/modules";
export default async function Page(){const s=await getModuleSettings();return <main className="account-module-setup"><header><h1>Module Selection</h1><p>Choose your business type, then select the optional modules you use.</p></header><ModuleSettingsForm values={s}/></main>}
