import { ClientMoney } from "./display-preferences";
export function humanize(value:string){return value.toLowerCase().split("_").map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(" ")}
export function StatusBadge({value}:{value:string}){const tone=/POSTED|PAID|APPROVED|ACTIVE|COMPLETED/.test(value)?"success":/CANCEL|REJECT|REVERSE|OVERDUE/.test(value)?"danger":/PENDING|DRAFT|IN_PROGRESS|PARTIAL/.test(value)?"warning":"neutral";return <span className={`account-status account-status-${tone}`}>{humanize(value)}</span>}
export function Money({value}:{value:{toString():string}|number|string}){return <ClientMoney value={value.toString()}/>}
