"use client";
import Link from "next/link";
import { useId, useState, useSyncExternalStore } from "react";
import { saveMoneyAdjustmentAction } from "@/app/actions/money";
import { ActionFeedbackForm, AccountFieldError, useAccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
const subscribeHydration=()=>()=>{};
function AdjustmentField({name,label,value,onChange,type="text",multiline=false,children,defaultValue,pattern}:{name:string;label:string;value?:string;onChange?:(value:string)=>void;type?:string;multiline?:boolean;children?:React.ReactNode;defaultValue?:string;pattern?:string}){
 const error=useAccountFieldError(name),id=useId();
 const attributes={name,"aria-invalid":!!error,"aria-describedby":error?id:undefined,"aria-label":label,required:true};
 return <label>{label}{children?<select {...attributes} defaultValue={defaultValue}>{children}</select>:multiline?<textarea {...attributes} value={value} onChange={event=>onChange?.(event.target.value)} minLength={3} maxLength={1000}/>:<input {...attributes} type={type} value={value} onChange={event=>onChange?.(event.target.value)} pattern={pattern} inputMode={name==="amount"?"decimal":undefined}/>}<AccountFieldError name={name} id={id}/></label>;
}
export function MoneyAdjustmentForm({
  accountId,
  branches,
  ledgers,
  requestKey,
  selectedBranch,
}: {
  accountId: string;
  branches: Array<{ id: string; name: string }>;
  ledgers: Array<{ id: string; name: string; accountClass: string }>;
  requestKey: string;
  selectedBranch?: string;
}) {
  const hydrated=useSyncExternalStore(subscribeHydration,()=>true,()=>false);
  const [key, setKey] = useState(requestKey);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  return (
    <section>
      <h2>Add / Reduce balance</h2>
      <p>
        For owner funding or withdrawals, use{" "}
        <Link href="/workspace/account/money/capital">Capital & Drawings</Link>.
        For movement between bank and cash, use{" "}
        <Link href="/workspace/account/money/transfers">Transfer</Link>.
      </p>
      <ActionFeedbackForm
        action={saveMoneyAdjustmentAction}
        className="stack"
        onSuccess={() => {
          setKey(crypto.randomUUID());
          setAmount("");
          setReason("");
        }}
      >
        <input type="hidden" name="moneyAccountId" value={accountId} />
        <input type="hidden" name="idempotencyKey" value={key} />
        <fieldset disabled={!hydrated} style={{display:"contents"}}><SavePendingFields>
          <AdjustmentField name="branchId" label="Posting branch" defaultValue={selectedBranch ?? branches[0]?.id}>
            {branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </AdjustmentField>
          <AdjustmentField name="direction" label="Adjustment" defaultValue="ADD"><option value="ADD">Add balance</option><option value="REDUCE">Reduce balance</option></AdjustmentField>
          <AdjustmentField name="offsetLedgerId" label="Offset ledger" defaultValue=""><option value="">Select the reason’s ledger</option>{ledgers.map(ledger=><option key={ledger.id} value={ledger.id}>{ledger.name} ({ledger.accountClass})</option>)}</AdjustmentField>
          <AdjustmentField name="amount" label="Amount" value={amount} onChange={setAmount} pattern="[0-9]{1,16}(\.[0-9]{1,2})?"/>
          <AdjustmentField name="date" label="Date" type="date"/>
          <AdjustmentField name="reason" label="Reason" value={reason} onChange={setReason} multiline/>
        </SavePendingFields></fieldset>
        <SaveSubmitButton disabled={!branches.length || !ledgers.length}>
          Post adjustment
        </SaveSubmitButton>
      </ActionFeedbackForm>
    </section>
  );
}
