const filterKeys = new Set(["scope", "from", "to", "asOf", "branchId", "projectId", "customerId", "vendorId", "productId", "ledgerId", "ownerId", "accountType"]);
/** Export exactly the displayed domain scope, never workspace-only navigation parameters. */
export function reportExportQuery(raw:Record<string,string|undefined>, from:string, to:string, lifetime=false) {
  const query=new URLSearchParams(Object.entries(raw).filter((entry):entry is [string,string]=>filterKeys.has(entry[0])&&Boolean(entry[1]?.trim())));
  if(lifetime){query.delete("from");query.delete("to");query.delete("asOf");}
  else {query.set("from",from);query.set("to",to);}
  return query.toString();
}
