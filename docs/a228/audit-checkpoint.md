# A228 — SALES_ORDER

Completed 2026-11-20. `/workspace/account/transactions/new?type=SALES_ORDER`. AUDIT ONLY. Shared document entry/options dispatch, linked-source preparation, pricing/unit/stock and replay baseline reviewed. No actual draft/post/stock/journal/notification changed.

Shared A228–A236 batch: 100 existing checks passed, zero failed/skipped across ten commercial/order/sale/purchase suites. This is shared coverage, not 100 separate cases per document type. Exact per-type native UI and live posting were not verified. These source/model/mocked runtime checks do not close every prior transaction finding. No additional defect established for this type in limited batch.

Entry uses allowedDocumentTypes from server options. Requested unavailable/unknown document type falls back to first allowed; this can surprise deep-link users and should be reviewed alongside payment fallback, but no unauthorized type post is demonstrated. Source-linked return/order/quotation paths validate allowed types, UUIDs and source state. Generic document editor supports draft-first Save/Share/Print; posting remains separate. Sale Invoice has specialized renderer. Existing original screenshot requirements remain relevant; this pass does not claim visual equivalence.

No production DB, real draft/post/cancellation, installed native build, actual PDF/share or live tax/ledger reconciliation. No new runtime probe specific to this one type beyond selected existing suites.

Next A229.
