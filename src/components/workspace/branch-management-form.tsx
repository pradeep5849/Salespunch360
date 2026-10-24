"use client";
import {manageBranch} from "@/app/actions/branches-management";
import {SaveFeedbackForm,SavePendingFields,SaveSubmitButton} from "@/components/account/save-feedback";

type BranchFields={id:string;name:string;code:string;addressLine1:string|null;city:string|null;state:string|null;postalCode:string|null;country:string|null;phone:string|null;email:string|null};
const errors={DUPLICATE_BRANCH_CODE:"This branch code is already in use. Choose another code.",PRIMARY_BRANCH_PROTECTED:"The primary branch cannot be deactivated.",BRANCH_IN_USE:"This branch has active access or records and cannot be deactivated.",NOT_FOUND:"This branch is no longer available. Reload the page."};
export function BranchManagementForm({branch,operation="create"}:{branch?:BranchFields;operation?:"create"|"edit"|"activate"|"deactivate"}){
 return <SaveFeedbackForm action={manageBranch} className="employee-form" errorMessages={errors}>
  <input type="hidden" name="operation" value={operation}/>{branch&&<input type="hidden" name="branchId" value={branch.id}/>}
  {(operation==="create"||operation==="edit")&&<SavePendingFields>
   {operation==="create"&&<h2>Add Branch</h2>}
   <div className="field-grid"><label>Name<input name="name" defaultValue={branch?.name} required minLength={2} maxLength={120}/></label><label>Code<input name="code" defaultValue={branch?.code} required maxLength={20}/></label>{[["addressLine1","Address"],["city","City"],["state","State"],["postalCode","Postal code"],["country","Country"],["phone","Phone"],["email","Email"]].map(([name,label])=><label key={name}>{label}<input name={name} type={name==="email"?"email":"text"} defaultValue={branch?.[name as keyof BranchFields]??""}/></label>)}</div>
  </SavePendingFields>}
  <SaveSubmitButton>{operation==="create"?"Create Branch":operation==="edit"?"Save":operation==="activate"?"Activate":"Deactivate"}</SaveSubmitButton>
 </SaveFeedbackForm>;
}
