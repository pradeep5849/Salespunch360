# Stock retry safety across web/native

Same continuing draft PR212. New opening/adjustment/transfer drafts carry a stable optional requestKey. Web keeps the key in client state across rerender/failure and rotates it only on confirmed success; Android keeps it for the editor draft and guards repeat taps. Keys are validated as UUIDs and used as source identity under existing company locking/transaction isolation.

Opening/adjustment replay validates the saved operation type, authorized warehouse/product, quantity, cost, date, batch/serial and reason before returning the original movement. Transfer replay checks the original paired source/destination movements before insufficient-stock validation, so a successful transfer remains replayable after consuming all source stock. Changed details with the same key reject as IDEMPOTENCY_CONFLICT. No stock/balance/audit write on confirmed replay. Existing warehouse/product/tracking guards retained. No schema changes.

Six actual PostgreSQL cases passed: sequential opening/adjustment, whole-source transfer replay, changed-payload refusal, native opening/adjustment, native paired transfer, and concurrent retries leaving one movement. Additional existing inventory suites: 20 passed. Earlier combined run: 25 passed with the first five SQL cases (overlapping, not additive). Full TypeScript and changed-file lint passed; full regression running. Final-head Android/browser acceptance remains required.

Older clients/requests without requestKey keep legacy non-idempotent behavior; updated UI/app is required for retry protection. New key after cancelling/reopening is a new intent, not proof an earlier uncertain request failed; refresh saved movements first. Concurrent serializable retries may reject with a retryable conflict, but cannot duplicate stock in the tested fixture. No production stock changed. These are implementation/fixture results, not installed-device certification.

Final local full suite after this batch: 4056 passed, 415 skipped, zero failed. Six opt-in stock SQL tests passed separately. Full TypeScript and changed-file lint passed. Final-head GitHub/native build and browser/device acceptance still required.
