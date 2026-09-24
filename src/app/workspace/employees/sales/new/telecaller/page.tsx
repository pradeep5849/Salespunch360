import Link from "next/link";
import { createTelecallerEmployeeAction } from "@/app/actions/telecaller-team";
import { getProductUserManagementContext } from "@/lib/users/product-user-management";
import { getTelecallerBillingOverviewForCompany } from "@/lib/billing/telecaller";

const errorText=(code?:string)=>({
  TELECALLER_SUBSCRIPTION_REQUIRED:"Purchase and activate a Telecaller subscription before adding a Telecaller.",
  TELECALLER_SEAT_LIMIT:"All paid Telecaller seats are already in use.",
  EMAIL_IN_USE:"That email address is already in use.",
  SALES_NOT_ENTITLED:"Telecalling requires the Sales or Plus workspace.",
}[code??""]??(code?"Could not add the Telecaller. Check the details and try again.":null));

export default async function AddTelecallerPage({searchParams}:{searchParams:Promise<{error?:string}>}){
  const ctx=await getProductUserManagementContext();
  if(ctx.actor.salesRole!=="PRIMARY_ADMIN"||!ctx.actor.companyId)throw new Error("Not authorized");
  const overview=await getTelecallerBillingOverviewForCompany(ctx.actor.companyId);
  const {error}=await searchParams;
  const message=errorText(error);
  if(overview.available<1)return <main className="employees-shell"><section className="employees-content"><h1>No Telecaller seat available</h1><p>Telecaller seats are separate from normal Sales seats and do not use a trial.</p><p><strong>{overview.used} / {overview.limit}</strong> paid seats are in use.</p><Link className="primary-button" href="/workspace/billing/telecaller">Manage Telecaller Subscription</Link><p><Link href="/workspace/employees?filter=telecallers">Back to Telecallers</Link></p></section></main>;
  return <main className="employees-shell"><section className="employees-content"><h1>Add Telecaller</h1><p>Uses a paid Telecaller seat only. This employee can call all company leads but cannot change lead stage or ownership.</p>{message?<p className="form-error" role="alert">{message}</p>:null}<form action={createTelecallerEmployeeAction} className="employee-form"><label>Name<input name="name" required maxLength={160}/></label><label>Email<input name="email" type="email" required maxLength={320}/></label><label>Mobile Number<input name="phone" inputMode="tel"/></label><label>Employee Code<input name="employeeCode" maxLength={80}/></label><label>Password<input name="password" type="password" minLength={12} required/></label><label>Confirm Password<input name="confirmPassword" type="password" minLength={12} required/></label><div><button>Save Telecaller</button> <Link href="/workspace/employees?filter=telecallers">Cancel</Link></div></form></section></main>;
}