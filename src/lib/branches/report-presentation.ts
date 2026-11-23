/** Remove display-only company location columns without changing totals or scope. */
export function presentBranchColumns<T extends {columns:string[];rows:(string|number)[][];totals?:(string|number)[]}>(data:T,enabled:boolean):T{
 if(enabled)return data;
 const keep=data.columns.map((label,index)=>({label,index})).filter(({label})=>!/^branch(?: name| code)?$|^firm \/ company branch$/i.test(label)).map(({index})=>index);
 return {...data,columns:keep.map(i=>data.columns[i]),rows:data.rows.map(row=>keep.map(i=>row[i])),...(data.totals?{totals:keep.map(i=>data.totals![i])}:{})};
}
export function branchPresentationScope(query:string,enabled:boolean){
 if(enabled)return query;
 const visible=new URLSearchParams(query);visible.delete('branchId');visible.delete('scope');return visible.toString()||'Company';
}
