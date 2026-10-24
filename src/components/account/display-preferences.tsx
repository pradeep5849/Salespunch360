"use client";
import {accountLabel} from "@/lib/account/account-labels";
import {createContext,useContext,useCallback} from "react";
import {DEFAULT_DISPLAY_PREFERENCES,type DisplayPreferences,formatCalendarDate,formatMoney} from "@/lib/account/display-preferences";
const Context=createContext<DisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);
export function DisplayPreferencesProvider({values,children}:{values:DisplayPreferences;children:React.ReactNode}) {
  return <Context.Provider value={values}>{children}</Context.Provider>;
}
export function useDisplayPreferences(){return useContext(Context)}
export function AccountDate({value}:{value:string}){return <>{formatCalendarDate(value,useDisplayPreferences())}</>}

export function ClientMoney({value}:{value:string}){return <span className="account-money">{formatMoney(value,useDisplayPreferences())}</span>}

export function useAccountLabel(){const preferences=useDisplayPreferences();return useCallback((label:string)=>accountLabel(label,preferences.appLanguage),[preferences.appLanguage])}
export function AccountText({children}:{children:string}){return <>{useAccountLabel()(children)}</>}

export function AccountCurrencySymbol(){const preferences=useDisplayPreferences();return <>{new Intl.NumberFormat(preferences.appLanguage=== "hi"?"hi-IN":"en-IN",{style:"currency",currency:preferences.baseCurrency}).formatToParts(0).find(part=>part.type==="currency")?.value??preferences.baseCurrency}</>}
