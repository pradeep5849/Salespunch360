export function SalesRoleOptions({managersEnabled,currentRole}:{managersEnabled:boolean;currentRole:string}){
 return <><option value="ADDITIONAL_ADMIN">Additional Admin</option>{managersEnabled?<><option value="SALES_MANAGER">Sales Manager</option><option value="OFFICE_MANAGER">Office Manager</option></>:['SALES_MANAGER','OFFICE_MANAGER'].includes(currentRole)?<option value={currentRole} disabled>Current Manager role — unavailable in Sales-only setup</option>:null}<option value="SALES_EMPLOYEE">Sales Employee</option></>;
}
