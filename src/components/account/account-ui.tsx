import { AccountDate, ClientMoney } from "./display-preferences";
export function humanize(value:string){return value.toLowerCase().split("_").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}
export function StatusBadge({value}:{value:string}){const tone=/POSTED|PAID|APPROVED|ACTIVE|COMPLETED/.test(value)?"success":/CANCEL|REJECT|REVERSE|OVERDUE/.test(value)?"danger":/PENDING|DRAFT|IN_PROGRESS|PARTIAL/.test(value)?"warning":"neutral";return <span className={`account-status account-status-${tone}`}>{humanize(value)}</span>}
export function Money({value}:{value:{toString():string}|number|string}){return <ClientMoney value={value.toString()}/>}

/** Keep the pre-existing server-local wall clock while applying the saved calendar format.
 * Calendar components must come from the same zone as the retained time, not UTC slicing. */
export function AccountTimestamp({value}:{value:Date}){
 const calendar=`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
 return <time dateTime={value.toISOString()}><AccountDate value={calendar}/>{" · "}{value.toLocaleTimeString()}</time>;
}
