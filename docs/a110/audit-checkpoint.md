# A110 — Sales & Purchases list audit complete

Original PDF label New document identifies /workspace/account/transactions; actual source title Sales & Purchases. Reuse related Home card references without claiming Home and Documents routes are identical.

Five findings: wrong purchase/non-invoice balances, cancelled-sale unpaid label, filter/selected-branch context, unbounded list/N+1 queries, and dedicated card action parity. Two server-render probes confirm wrong paid-purchase balance and cancelled-sale label using synthetic fixtures.28existing policy/Home checks plus2probes passed:30total,0failed/skipped. Probe pass captures defects, not fixes.

No application/production changes; no A110 browser/device/load certification. Prior Home PDF sharing retained as existing correct work. All5findings remain NOT STARTED. A111 Audit history /workspace/account/utilities/audit next; reference required.
