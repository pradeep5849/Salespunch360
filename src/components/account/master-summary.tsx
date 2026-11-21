/** Explicit saved fields only; never dump arbitrary master metadata. */
export function MasterSummary({value,canViewCosts=false}:{value:object;canViewCosts?:boolean}) {
  const row=value as Record<string,unknown>;
  const fields=[['contactPerson','Contact'],['gstin','GSTIN'],['salePrice','Sale price'],['costPrice','Cost price'],['sellingRate','Selling rate'],['estimatedCost','Estimated cost'],['taxRate','Tax rate'],['hsnCode','HSN'],['sacCode','SAC']] as const;
  const relationName=(key:string)=>{const value=row[key];return value&&typeof value==='object'&&'name' in value?String(value.name):null};
  return <>{fields.map(([key,label])=>(!(key==='costPrice'||key==='estimatedCost')||canViewCosts)&&row[key]!=null&&row[key]!==''?<p key={key}>{label}: {String(row[key])}{key==='taxRate'?'%':''}</p>:null)}
    {relationName('unit')&&<p>Unit: {relationName('unit')}</p>}
    {(relationName('category')||relationName('workCategory'))&&<p>Category: {relationName('category')??relationName('workCategory')}</p>}
    {typeof row.trackInventory==='boolean'&&<p>Inventory tracking: {row.trackInventory?'Enabled':'Disabled'}</p>}
    {typeof row.isActive==='boolean'&&<p>{row.isActive?'Active':'Inactive'}</p>}
  </>;
}
