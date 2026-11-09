# Payment-In reference implementation contract (issue #192)

## Approved UI
Compact Payment-In screen: receipt number/date, firm, searchable Customer Name with Add New Party, conditional Party Balance, editable auto-filled Billing Name, Received with Link, Total Amount, Payment Type, + Add Payment Type, Description, optional evidence, Save & New, Save, three-dot menu. No More Options section. Do not show CUSTOMER_RECEIPT/VENDOR_PAYMENT enum picker in Payment-In.

## Payment Type
Payment Type is a selection of an existing money account (Cash, Bank Account 1, Bank Account 2, etc.). **+ Add Payment Type creates a new money account** and returns to select it. It does **not** split a receipt across accounts. Credit the entire received amount to the selected account exactly once. Keep existing cheque-clearing rules if applicable.

## Customer selection
Search existing parties by name/mobile; + Add New Party uses the existing party creation flow and preserves receipt draft. After selecting a customer, display actual party ledger balance, auto-fill editable Billing Name and show Link. Before selection, hide balance and Link.

## Linking
Open dedicated Link Payment To Txns screen. Show selected customer's eligible sales invoices, dates, numbers, original totals, outstanding amounts, selectable checkboxes, editable link amounts, total received, unused amount, Cancel/Done. Validate each allocation <= its invoice outstanding; total linked <= received and <= total eligible outstanding. Example: outstanding ₹593, received ₹1100, link at most ₹593, unused credit ₹507, resulting invoice balance ₹0. Unused amount becomes available customer credit, not an extra invoice settlement. All validation must be enforced server-side, with atomic posting and idempotency.

## Delivery
Implement both web and Android parity where applicable. Preserve existing accounting, numbering, attachments, sync and historical data. Test partial/full/multi-invoice allocations, concurrent payments, unused credit, account selection and account creation. Run lint/typecheck/tests/build and fix failures. Do not merge until CI is green and user approves.
