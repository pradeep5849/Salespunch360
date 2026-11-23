export function filterDirectoryUsers<T extends {name:string;email:string;phone?:string|null}>(users:T[],query:string){
 const text=query.trim().toLowerCase();
 return text?users.filter(user=>[user.name,user.email,user.phone??''].some(value=>value.toLowerCase().includes(text))):users;
}
export function employeeSearchHref(href:string,query:string){
 const url=new URL(href,'https://salespunch360.invalid');
 if(query)url.searchParams.set('q',query);
 return url.pathname+(url.searchParams.size?'?'+url.searchParams.toString():'');
}
