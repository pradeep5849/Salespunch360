# Account-only Billing policy

Owner decision on 2026-11-23: hide Billing entirely for Account-only Admins; creating/renewing subscriptions remains forbidden. A128-F04 is now resolved by that policy rather than granting a new read capability.

Web Account profile no longer offers Billing merely because the user has ACCOUNT_ADMIN. The shared authenticated Billing hub/dashboard/history/order read gate requires Sales Billing authority; Account access alone does not grant visibility. Native Account/Main Admin profile menus use the server's existing canAccessSalesBilling capability, and resumed/direct local Billing routes do not render subscription data without it. Native read/quote/order gates remain denied for Account-only principals. Authorized Plus Main Admin pricing remains tested. Capture/provider and internal verified-payment workflows are unchanged.

Validation: 36 focused checks and two isolated Chromium menu cases passed; TypeScript, targeted lint and whitespace passed. The earlier configured-price test now retains coverage for an authorized Plus Main Admin and separately proves that Account-only reads stop before prices/data are fetched. No financial records changed. Slice 6 since the last full regression; no new full run. Current-head native/device acceptance remains pending.

First-branch follow-up 7201c920: the native branch HTTP route now authenticates either workspace before the shared current-Main-Admin gate, allowing an Account-only Main Admin to manage branches without granting Sales or Billing access. Ten targeted route/company/branch checks passed; TypeScript passed. Ordinary Account Admins remain denied by the Main Admin gate.
