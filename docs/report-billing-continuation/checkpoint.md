# Report and billing continuation — 22 November 2026

Continuing PR #212; not deployment or complete acceptance.

- A155-F02: native Sales check-in cards display saved checkout time, sentiment, remarks and visit notes, omitting empty values. Creation/checkout flow unchanged.
- A155-F03: Sales check-in paging preserves the shared URL's date/status/sentiment/customer/branch/range/search selections; server scope still applies.
- A157-F01: geofence category summaries intersect their dimension with all active filters instead of replacing action/type conditions.
- A157-F02: native geofence action/type/customer-name filters use one paging/export helper. `geofenceType` avoids collision with mobile report routing's `type`; shared report accepts the alias and web's existing key.
- A125-F03: native additions use the active subscription's authoritative billingPeriod, already supplied by the API, rather than paginated paid-order history. Missing period fails closed with reload guidance.
- A125-F04: native Add Sales quote failures display local recovery guidance while preserving input; pending state ends so retry is possible.
- A127-F03: native Sales/Plus renewal and Account quote failures use the same local recovery presentation. Shared implementation also covers Account additions. This does not resolve separate renewal-intent or atomic order enrichment findings.
- A128-F01: web hub/actions and native hub/actions expose Payment History.
- A128-F02: web payment history uses company-authorized bounded pages, stable createdAt/id ordering and sentinel navigation instead of a silent fifty-order cap. History shows full order reference and labels IST creation time; capture/payment detail finding remains open.
- A129-F03: web billing hub loads only authorization/company navigation context, so pricing/order/Telecaller enrichment failure cannot block its navigation. Destination pages retain their own read authorization.

Focused billing/report run: 210 passed / 8 optional SQL skipped. New checks exercise company-scoped history paging, denied history reads, hub independence from ancillary queries, geofence filter intersections/alias, and preservation of Sales report query parameters. Native pure helper tests added for filter encoding and quote guidance; Android CI required after push. Final TS/lint/full-suite results are recorded in progress.md.

Deferred decisions: native Account-only billing read access (A128-F04) remains open under the owner's purchase prohibition. Linked/active visit deletion policy and complete own-visit deletion workflow remain separate retained findings. No excluded Unlink action or new check-in creation design introduced. No real order, payment, visit, security/CDN setting, production schema, deployment or merge changed.
