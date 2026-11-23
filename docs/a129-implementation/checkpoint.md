# A129 Account-only admin restriction

21 November 2026, same draft PR212. Web billing mutation boundary now rejects principals with Account-only billing authority who are not PRIMARY_ADMIN. Company primary ownership and existing Sales billing authority remain distinct; read-only billing access is not revoked. Mobile mutation endpoint already requires PRIMARY_ADMIN and applicable Sales billing access; no permission expansion introduced. Actual Account package and Sales order entrypoint tests confirm denied Account-only admins reach neither price reads nor order transactions.

Two new denial tests plus existing billing guards/concurrency/manual payment cases passed in a 23-case run. A separate 33-case broader checkout/billing run also passed; do not add overlapping totals. Remaining billing UI capability presentation and other A129/A128 findings are not declared fixed. Earlier inherited error-key guard is in separate commit. No order/payment created against production.
