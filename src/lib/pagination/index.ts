import {z} from 'zod';
export const pageFields={page:z.coerce.number().int().min(1).max(100000).default(1),pageSize:z.coerce.number().int().min(1).max(100).default(50)};
export function pageWindow(raw:unknown={}){const p=z.object(pageFields).parse(raw);return{...p,skip:(p.page-1)*p.pageSize,take:p.pageSize+1};}
export function pageResult<T>(rows:T[],raw:unknown={}){const p=pageWindow(raw);return{items:rows.slice(0,p.pageSize),page:p.page,pageSize:p.pageSize,hasMore:rows.length>p.pageSize};}
