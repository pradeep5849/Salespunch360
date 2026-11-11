# A118 — Period Locks: source audit and authorized Utilities navigation

Date: 11 November 2026 (Asia/Kolkata). Reference inventory route: `/workspace/account/utilities/period-locks`.

The owner authorized audit continuation plus making Period Locks available under Utilities. Implementation scope is the navigation entry only. No financial lock, year close, numbering restart, production database write or hosting/security change was executed.

## Navigation implementation

Move the existing permission-filtered Period Locks destination from Accounting into Utilities, after Close Financial Year. Preserve `ACCOUNT_PERIOD_LOCK` and the existing route. Both web Menu and mobile navigation context consume `buildAccountNavigation`; Android already dispatches this route to `FinancialYearScreen(true, padding)`. Existing role policy permits Account Admins, not Data Entry/Accountant/Project Manager. No permission expansion is included.

## Audit findings

- **A118-F01 — navigation discoverability (Low):** owner expects Menu → Utilities → Period Locks; entry was under Accounting. Implemented in this change, pending merge and deployed UI verification. This updates the previously approved six-item menu by explicit owner request.
- **A118-F02 — advance-lock review and feedback (Medium, OPEN):** the web form submits directly to `advancePeriodLockAction`, without a consequence review or explicit confirmation; it has no dedicated local success/error state. Native editor similarly submits date and reason. Advancing prevents later financial corrections in the affected period and normal UI cannot move it backward. Recommend clear affected-year/current/new-date review and controlled confirmation/error feedback. No lock was changed to probe this.
- **A118-F03 — closed-year mutation policy (Low, OPEN):** `setPeriodLockForActor` requires an active company-scoped year but does not require `status === OPEN`, while web choices include only OPEN years. Native `FinancialYearScreen` passes its year list to the lock editor without an OPEN-only filter. A direct request can therefore alter lock metadata on a closed active year. This does not reopen the year or bypass its posting guard. Recommend consistent closed-year read-only policy and regression coverage for web/native/API. Source inspection only; no production request attempted.

## Evidence and limits

Reviewed web page/action, shared navigation, mobile context/dispatch/editor, `periodLockSchema`, and `setPeriodLockForActor`. Existing service transaction takes a company lock, uses serializable isolation, checks company/year/date bounds, rejects null/backward dates, and appends PERIOD_LOCKED with reason. Authorization entrypoints exist for web and mobile. These are source observations, not certification that every posting/cancellation path enforces a lock.

43 focused checks passed in four files: Utilities role/order/uniqueness, menu SSR, accounting runtime regressions and mobile navigation contract. The existing accounting runtime checks include posting rejection on locked dates. This run did not execute the opt-in PostgreSQL lock/concurrency suites, physical Android interaction, browser visual parity, or live deployed navigation. No reference Period Locks screenshot was supplied; exact reference parity remains unverified. Full posting/reversal lifecycle coverage and lock-date concurrency require further audit evidence before declaring A118 fully verified.

The Lighthouse issue remains deferred by owner instruction and is separate from this change.
