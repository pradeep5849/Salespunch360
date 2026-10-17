import type { KeyboardEvent } from "react";
/** Keep Tab within the active dialog, excluding hidden and disabled controls. */
export function trapDialogFocus(event:KeyboardEvent<HTMLDialogElement>){
 if(event.key!=="Tab"||(event.target as Element).closest("dialog[open]")!==event.currentTarget)return;
 const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')).filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&node.getClientRects().length>0);
 const first=controls[0],last=controls.at(-1);if(!first||!last){event.preventDefault();return;}
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
