# A131 — Renewal

Completed 2026-11-19, AUDIT ONLY, keep current UI. Route `/workspace/billing/renewal`. Owner requests no billing reference images; audit against current behavior, source and confirmed policy.

No independent new finding assigned. Existing findings remain open:

- A127-F01 (High): page emits RENEW for active paid Sales/Plus, but downstream quote/order creation loses renewal intent and treats active-term capacity as additions. The renewal page calculates a full-period total while checkout can quote zero base for unchanged capacity. Prior A127 service evidence applies; this audit verifies the actual renewal page submits RENEW.
- A129-F01 (Medium): Account-only admin is offered Account Renewal and a checkout form although owner prohibits creating/renewing subscriptions. This is additional UI evidence of the existing service-policy gap, not a new duplicate. Viewing permissions/alternative purchaser remain unspecified.
- A124-F01 configured Account pricing and A125-F02 paise rounding affect shared renewal surfaces.

Probes cover paid capacity defaults, inactive usage defaults and NEW intent, Plus package controls, denied dashboard propagation, and Account-only checkout entry. These are mocked dashboard plus actual server render/calculator tests, not browser interactions. No form submitted, payment created or permission changed.

Shared A131–A133 run: 30 passed, 0 failed/skipped (12 audit probes, 18 existing retention/current-term/Telecaller surface cases). Sources and output in this directory. Two initial probe failures were attribute-order-sensitive assertions; corrected probe strings and reran the same scope successfully. Application source unchanged. Passing defect probes reproduces observations, not approval of them.

Next A132 — Subscription, audited in the same checkpoint.
