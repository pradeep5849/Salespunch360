import {quotationThemeSchema,quotationThemeProfile} from "./theme-catalogue";
/** Public print presentation exposes only validated styling, never settings JSON. */
export type QuotationPrintPresentation={theme:string;color?:string;amountWordsFormat:"INDIAN"|"INTERNATIONAL"};
export function quotationPrintPresentation(defaults:unknown):QuotationPrintPresentation {
 const settings=defaults&&typeof defaults==="object"&&!Array.isArray(defaults)?(defaults as Record<string,unknown>).invoicePrintSettings:null;
 const values=settings&&typeof settings==="object"&&!Array.isArray(settings)?settings as Record<string,unknown>:{};
 const chosen=quotationThemeSchema.safeParse(defaults&&typeof defaults==="object"&&!Array.isArray(defaults)?(defaults as Record<string,unknown>).quotationPrintTheme:null);
 if(chosen.success)return{...chosen.data,amountWordsFormat:values.amountWordsFormat==="INTERNATIONAL"?"INTERNATIONAL":"INDIAN"};
 return {theme:typeof values.theme==="string"&&/^(REGULAR|MODERN|CLASSIC|MINIMAL|#[0-9a-f]{6})$/i.test(values.theme)?values.theme.toUpperCase():"REGULAR",amountWordsFormat:values.amountWordsFormat==="INTERNATIONAL"?"INTERNATIONAL":"INDIAN"};
}
export function quotationPdfTheme(presentation?:QuotationPrintPresentation){
 const selected=quotationThemeSchema.safeParse({theme:presentation?.theme,color:presentation?.color});
 const theme=selected.success?selected.data.theme:quotationPrintPresentation({invoicePrintSettings:presentation}).theme;
 const color=selected.success?selected.data.color:/^#[0-9A-F]{6}$/.test(theme)?theme:({MODERN:"#0f766e",CLASSIC:"#4338ca",MINIMAL:"#374151",REGULAR:"#0b1930"}[theme]??"#0b1930");
 return {profile:quotationThemeProfile(theme),color,margin:theme==="MINIMAL"?48:40,titleSize:theme==="CLASSIC"?15:theme==="MINIMAL"?11:14,ruleWidth:theme==="MINIMAL"?0.5:theme==="MODERN"?3:1.5};
}
