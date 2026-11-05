import type {AccountPrintDocument} from "./print";
const themes=["REGULAR","MODERN","CLASSIC","MINIMAL"];
/** Temporary appearance only; identity, amounts and persisted preferences cannot change. */
export function printPreviewOptions(document:AccountPrintDocument,query:URLSearchParams):AccountPrintDocument {
 const theme=query.get("theme"),color=query.get("color");
 if(theme&&!themes.includes(theme))throw new Error("INVALID_PRINT_PREVIEW");
 if(color&&!/^#[0-9a-f]{6}$/i.test(color))throw new Error("INVALID_PRINT_PREVIEW");
 return theme||color?{...document,printOptions:{...document.printOptions,theme:color??theme!}}:document;
}
