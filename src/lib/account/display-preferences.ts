export type DisplayPreferences = {
  appLanguage: "en" | "hi";
  baseCurrency: string;
  displayDecimalPlaces: number;
  dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
};
export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  appLanguage: "en", baseCurrency: "INR", displayDecimalPlaces: 2, dateFormat: "DD/MM/YYYY",
};
export function resolveDisplayPreferences(value:{appLanguage?:string;baseCurrency?:string;displayDecimalPlaces?:number;dateFormat?:string}|null|undefined):DisplayPreferences {
  return {
    appLanguage:value?.appLanguage==="hi"?"hi":"en",
    baseCurrency:["INR","USD","EUR","GBP","AED"].includes(value?.baseCurrency??"")?value!.baseCurrency!:"INR",
    displayDecimalPlaces:Number.isInteger(value?.displayDecimalPlaces)?Math.min(4,Math.max(0,value!.displayDecimalPlaces!)):2,
    dateFormat:value?.dateFormat==="MM/DD/YYYY"?"MM/DD/YYYY":value?.dateFormat==="YYYY-MM-DD"?"YYYY-MM-DD":"DD/MM/YYYY",
  };
}
export function formatMoney(value:{toString():string}|number|string, preferences:DisplayPreferences=DEFAULT_DISPLAY_PREFERENCES) {
  const amount=Number(value.toString());
  if(!Number.isFinite(amount))return value.toString();
  return new Intl.NumberFormat(preferences.appLanguage==="hi"?"hi-IN":"en-IN", {
    style:"currency",currency:preferences.baseCurrency,
    minimumFractionDigits:preferences.displayDecimalPlaces,maximumFractionDigits:preferences.displayDecimalPlaces,
  }).format(amount);
}
export function formatCalendarDate(value:Date|string, preferences:DisplayPreferences=DEFAULT_DISPLAY_PREFERENCES) {
  const date=value instanceof Date?value.toISOString().slice(0,10):value.slice(0,10);
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if(!match)return date;
  const [,year,month,day]=match;
  return preferences.dateFormat==="YYYY-MM-DD"?date:preferences.dateFormat==="MM/DD/YYYY"?`${month}/${day}/${year}`:`${day}/${month}/${year}`;
}
