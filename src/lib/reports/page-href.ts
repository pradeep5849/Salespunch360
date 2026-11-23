import type {SearchParams} from './validation';
/** Preserve the reviewed selection when moving between pages. */
export function reportPageHref(raw:SearchParams,page:number){const query=new URLSearchParams();for(const[key,value]of Object.entries(raw)){const first=Array.isArray(value)?value[0]:value;if(first&&key!=='page')query.set(key,first)}query.set('page',String(page));return `?${query.toString()}`}
