"use client";
import {SaveFeedbackForm,SaveSubmitButton} from '@/components/account/save-feedback';
import {setTelecallerActiveWithFeedback} from '@/app/actions/telecaller-team';
export function TelecallerStatusForm({id,name,active}:{id:string;name:string;active:boolean}){
 return <SaveFeedbackForm action={setTelecallerActiveWithFeedback} successMessage="Telecaller status saved; previous sessions revoked." errorMessages={{CONFIRMATION_REQUIRED:'Confirm the employee and status change first.',TELECALLER_SEAT_LIMIT:'No paid Telecaller seat is available.',TELECALLER_SUBSCRIPTION_REQUIRED:'An active Telecaller subscription is required.',STATUS_SAVE_FAILED:'Status was not saved. Refresh and check your access before trying again.'}}><input type="hidden" name="userId" value={id}/><input type="hidden" name="active" value={active?'false':'true'}/><label><input type="checkbox" name="confirmStatusChange" value="yes" required/>I confirm {active?'deactivating':'reactivating'} {name}{active?' and stopping their Call access.':'. Paid Telecaller capacity is required.'}</label><SaveSubmitButton className="secondary-button">{active?'Deactivate':'Reactivate'}</SaveSubmitButton></SaveFeedbackForm>;
}
