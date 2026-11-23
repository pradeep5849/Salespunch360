# Billing price/review slices A125–A126

21 November 2026, same PR212. Account checkout uses configured dashboard rates, not default constants, and rejects invalid quantities/periods without truncating or silently choosing a different term. Sales checkout rejects malformed/negative/fractional/out-of-range seat quantities and invalid Plus package counts. Currency labels preserve paise. Add-Team inputs cap additions at remaining total-seat capacity rather than allowing targets above 10000.

33 focused billing/checkout cases passed, including seven new configured-price/strict-input cases, backend Account-only mutation denial and existing concurrency/manual flow contracts. Changed-file lint/full TypeScript passed. No real subscription quote/order/payment executed. Pending-order intent reuse, full native parity, stale quote/review and remaining A124–A127 findings remain open; no whole-page closure claimed.
