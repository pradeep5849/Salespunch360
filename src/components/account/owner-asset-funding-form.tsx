"use client";
import { useState } from "react";
import type { OwnerAssetFundingOptions } from "@/lib/account/owner-asset-funding";
import {
  saveAssetFundingAction,
  saveAssetFundingConfirmationAction,
  cancelAssetFundingAction,
} from "@/app/actions/owner-asset-funding";
import { ActionFeedbackForm, AccountFieldError } from "./action-feedback-form";
import { SavePendingFields, SaveSubmitButton } from "./save-feedback";
import { AccountDate } from "./display-preferences";
import { Money } from "./account-ui";
type Props = {
  options: OwnerAssetFundingOptions;
  canPost: boolean;
  today: string;
  requestKey: string;
  formKeys: Record<string, string>;
};
export function OwnerAssetFundingForm({
  options,
  canPost,
  today,
  requestKey,
  formKeys,
}: Props) {
  const [assetId, setAsset] = useState(""),
    [sourceId, setSource] = useState(""),
    [key, setKey] = useState(requestKey),
    asset = options.summary.find((row) => row.id === assetId),
    sources = options.sources.filter((row) => row.branchId === asset?.branchId),
    source = sources.find((row) => row.id === sourceId);
  return (
    <div className="stack">
      <p>
        Record owner funding against a saved investment. Capital repayments
        change its funding split while preserving the asset’s purchase cost.
        Assets without confirmed funding remain unclassified.
      </p>
      {canPost && (
        <ActionFeedbackForm
          action={saveAssetFundingAction}
          onSuccess={() => {
            setKey(crypto.randomUUID());
            setSource("");
          }}
          className="stack"
        >
          <h2>Allocate owner funding</h2>
          <input type="hidden" name="requestKey" value={key} />
          <input type="hidden" name="branchId" value={asset?.branchId ?? ""} />
          <input
            type="hidden"
            name="expectedPurchaseValue"
            value={asset?.purchaseValue ?? ""}
          />
          <input
            type="hidden"
            name="ownerFinancialAccountId"
            value={source?.ownerFinancialAccountId ?? ""}
          />
          <SavePendingFields>
            <label>
              Retained asset
              <select
                required
                name="assetId"
              aria-label="Retained asset"
                value={assetId}
                onChange={(e) => {
                  setAsset(e.target.value);
                  setSource("");
                }}
              >
                <option value="">Select asset</option>
                {options.summary.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            {asset && (
              <p>
                Purchase cost: <Money value={asset.purchaseValue} />
              </p>
            )}
            <label>
              Owner investment
              <select
                required
                name="contributionTransactionId"
              aria-label="Owner investment"
                value={sourceId}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Select investment</option>
                {sources.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.ownerName} · {row.number} · {row.amount}
                  </option>
                ))}
              </select>
              <AccountFieldError name="contributionTransactionId" />
            </label>
            {asset && !sources.length && (
              <p>
                No matching posted investments. Search above or record an owner
                investment in this branch.
              </p>
            )}
            <label>
              Owner-funded amount
              <input
                required
                name="amount"
                inputMode="decimal"
                pattern="[0-9]{1,16}(\.[0-9]{1,2})?"
              />
              <AccountFieldError name="amount" />
            </label>
            <label>
              Allocation date
              <input
                required
                name="allocationDate"
                type="date"
                defaultValue={today}
              />
            </label>
            <label>
              <input required type="checkbox" name="confirmCompanyRemainder" />
              Confirm the remaining asset cost as company-funded
            </label>
          </SavePendingFields>
          <SaveSubmitButton disabled={!asset || !source}>
            Record funding
          </SaveSubmitButton>
        </ActionFeedbackForm>
      )}
      <h2>Retained asset funding</h2>
      {!options.summary.length && <p>No retained assets in this scope.</p>}
      {options.summary.map((row) => (
        <section
          className="account-panel"
          key={row.id}
          aria-label={`Funding for ${row.name}`}
        >
          <h3>{row.name}</h3>
          <dl>
            <dt>Purchase cost</dt>
            <dd>
              <Money value={row.purchaseValue} />
            </dd>
            <dt>Recorded owner funding</dt>
            <dd>
              <Money value={row.ownerFunded} />
            </dd>
            <dt>Company-funded remainder</dt>
            <dd>
              {row.companyFunded === null ? (
                "Not confirmed"
              ) : (
                <Money value={row.companyFunded} />
              )}
            </dd>
            {row.companyFunded === null && (
              <>
                <dt>Unclassified remainder</dt>
                <dd>
                  <Money value={row.unallocated} />
                </dd>
              </>
            )}
          </dl>
          {row.fundingStatus === "REVIEW_REQUIRED" && (
            <p>
              The purchase cost changed. Review and confirm the current funding
              classification.
            </p>
          )}
          {canPost && (
            <FundingConfirmation
              asset={row}
              requestKey={formKeys[`confirmation:${row.id}`]}
            />
          )}
          {row.fundings.map((funding) => (
            <div key={funding.id}>
              <p>
                {funding.ownerName}: <Money value={funding.remainingAmount} />{" "}
                remaining · <Money value={funding.originalAmount} /> originally
                allocated
              </p>
              {canPost && funding.returnedAmount === "0.00" && (
                <FundingCorrection
                  fundingId={funding.id}
                  cost={row.purchaseValue}
                  requestKey={formKeys[`correction:${funding.id}`]}
                />
              )}
            </div>
          ))}
        </section>
      ))}
      <h2>Allocation history</h2>
      <p>Latest 200 allocations in this scope.</p>
      {!options.history.length ? (
        <p>No recorded allocations.</p>
      ) : (
        <div className="account-table-wrap" tabIndex={0} role="region" aria-label="Allocation history table">
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th>Owner</th>
                <th>Original funding</th>
                <th>Allocation date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {options.history.map((row) => (
                <tr key={row.id}>
                  <td>{row.assetName}</td>
                  <td>{row.ownerName}</td>
                  <td>
                    <Money value={row.amount} />
                  </td>
                  <td>
                    <AccountDate value={row.allocationDate} />
                  </td>
                  <td>
                    {row.cancellation
                      ? `Cancelled: ${row.cancellation.reason}`
                      : row.assetStatus === "DISPOSED"
                        ? "Disposed asset"
                        : "Recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function FundingConfirmation({
  asset,
  requestKey,
}: {
  asset: OwnerAssetFundingOptions["summary"][number];
  requestKey: string;
}) {
  const [key, setKey] = useState(requestKey);
  return (
    <details>
      <summary>Confirm or clear funding classification</summary>
      <ActionFeedbackForm
        action={saveAssetFundingConfirmationAction}
        onSuccess={() => setKey(crypto.randomUUID())}
      >
        <input type="hidden" name="requestKey" value={key} />
        <input type="hidden" name="assetId" value={asset.id} />
        <input type="hidden" name="branchId" value={asset.branchId} />
        <input
          type="hidden"
          name="expectedPurchaseValue"
          value={asset.purchaseValue}
        />
        <SavePendingFields>
          <label>
            Classification
            <select name="confirmed">
              <option value="true">Remaining cost is company-funded</option>
              <option value="false">Funding not established</option>
            </select>
          </label>
          <label>
            Reason
            <input name="reason" required minLength={3} maxLength={1000} />
          </label>
        </SavePendingFields>
        <SaveSubmitButton>Save classification</SaveSubmitButton>
      </ActionFeedbackForm>
    </details>
  );
}
function FundingCorrection({
  fundingId,
  cost,
  requestKey,
}: {
  fundingId: string;
  cost: string;
  requestKey: string;
}) {
  const [key, setKey] = useState(requestKey);
  return (
    <details>
      <summary>Correct allocation</summary>
      <p>
        This cancels the allocation without changing the original investment or
        making a payment.
      </p>
      <ActionFeedbackForm
        action={cancelAssetFundingAction}
        onSuccess={() => setKey(crypto.randomUUID())}
      >
        <input type="hidden" name="fundingId" value={fundingId} />
        <input type="hidden" name="expectedPurchaseValue" value={cost} />
        <input type="hidden" name="requestKey" value={key} />
        <SavePendingFields>
          <label>
            Correction reason
            <input required name="reason" minLength={3} maxLength={1000} />
          </label>
          <label>
            <input required type="checkbox" name="confirmCompanyRemainder" />
            Confirm the remaining asset cost as company-funded
          </label>
        </SavePendingFields>
        <SaveSubmitButton>Cancel allocation</SaveSubmitButton>
      </ActionFeedbackForm>
    </details>
  );
}
