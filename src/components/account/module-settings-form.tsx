"use client";
import {useState} from "react";
import {saveAccountModules} from "@/app/actions/account-modules";
import {recommendedSetupModules} from "@/lib/account/module-setup";
import type {getModuleSettings} from "@/lib/account/modules";
import {SaveFeedbackForm,SavePendingFields,SaveSubmitButton} from "./save-feedback";

export function ModuleSettingsForm({values}:{values:Awaited<ReturnType<typeof getModuleSettings>>}) {
 const [businessType,setBusinessType]=useState(values.businessType);
 const recommended=recommendedSetupModules(businessType);
 return <SaveFeedbackForm action={saveAccountModules}>
  <SavePendingFields>
   <section className="account-card"><span className="account-step">Step 1</span><h2>Business Type</h2><label><span className="sr-only">Business Type</span><select aria-label="Business Type" name="businessType" value={businessType} onChange={event=>setBusinessType(event.target.value as typeof businessType)} required>{values.businessTypes.map(type=><option value={type.key} key={type.key}>{type.label}</option>)}</select></label></section>
   <section className="account-card"><span className="account-step">Step 2</span><h2>Modules</h2><div className="account-module-list">{values.moduleCatalog.map(module=><label key={module.key} className={!module.available?"unavailable":""}><span><strong>{module.label}</strong><small>{module.note}{recommended.includes(module.key as never)&&module.available&&module.key!=="BASIC_ACCOUNTING"?" · Recommended":""}</small></span>{module.key==="BASIC_ACCOUNTING"?<b>Core</b>:module.available?<input type="checkbox" name="enabledModules" value={module.key} defaultChecked={values.enabledModules.includes(module.key as never)}/>:<b>Coming Soon</b>}</label>)}</div></section>
  </SavePendingFields>
  <SaveSubmitButton className="account-primary">Save setup</SaveSubmitButton>
 </SaveFeedbackForm>;
}
