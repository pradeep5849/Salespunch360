# A238 — CUSTOMER_ADVANCE

Completed 2026-11-20. `/workspace/account/transactions/money?type=CUSTOMER_ADVANCE`. AUDIT ONLY.

Shared resolveInitialMoneyType returns first allowed type when requested type is unavailable. Probe shows VENDOR_PAYMENT request can become CUSTOMER_RECEIPT when only latter is allowed. It does not authorize forbidden writes, but deep-link intent changes without clear notice. Explain unavailable type instead of silently changing entry purpose. Same shared defect across four routes; not four independent bugs. Money form keeps stable request identity; permissions/modules and branch options remain backend controlled.

## Evidence and limits

Shared A237–A242 batch: 16 passed, zero failed/skipped; four new pure/source probes plus 12 existing money-form/project-payment/advance cases. Source/pure/model evidence only; no actual payment/advance, bank/party posting or production ledger change. Global recovery was not triggered in browser. No installed native device or real network retry tested. Passing defect probes records gaps, not fixes. Existing transaction findings remain open.

Next A239.
