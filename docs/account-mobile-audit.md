# Account mobile phase-one audit

This audit was completed before implementation on `feature/account-mobile-home-dashboard`.
The phase-one implementation intentionally reuses the existing commercial, accounting and
authorization domains rather than introducing a second mobile accounting model.

| Requested area | Web route/component | Shared service/API | Android screen/API | Decision |
| --- | --- | --- | --- | --- |
| Account Home | `/workspace/account`, `AccountShell` | `accountHomeScopes` | `AccountHomeScreen`, bootstrap/dashboard APIs | EXTEND |
| Dashboard | `/workspace/account/dashboard` | `accountBranchDashboard` | `AccountDashboardScreen`, `/api/v1/mobile/account/dashboard` | EXTEND |
| Navigation | `AccountBottomNav`, account Menu | `buildAccountNavigation` permission policy | `NativeAccountAuthenticatedApp` | EXTEND |
| Transactions | `/workspace/account/transactions/*` | `commercial.ts`, mobile transactions/purchases APIs | sales/purchase screens | REUSE + EXTEND bounded Home query |
| Sale invoices / purchase documents | existing commercial editors and details | commercial document service, tax and numbering services | sales/purchase editors | REUSE |
| Parties | `/workspace/account/customers` | existing `Customer` with `isAccountCustomer` | `AccountMasterScreen`, master-data API | REUSE + EXTEND Home summary |
| Reports / statements | `/workspace/account/reports` | account report service and export routes | `AccountReportsScreen` | REUSE (statement remains report workflow) |
| Inventory / expenses / cash-bank | existing Account routes | inventory, expense and money services | existing native screens/APIs | REUSE |
| Financial reports | reports route | report service | account reports API/screen | REUSE |
| Transaction and party settings | `/workspace/account/settings` | `AccountSettings`, settings service/API | native `SettingsScreen` | EXTEND in later settings slice |
| Print / PDF / sharing | document details and print templates | versioned templates and report/document exports | download/share-capable native document screens | REUSE; no second renderer |
| GST / tax | commercial editor | `calculateTax`, commercial service | shared commercial APIs | REUSE |
| Invoice numbering / prefixes | commercial editor | `NumberingSeries`, atomic allocator | shared commercial APIs | REUSE |
| Payment status | transaction details | settlements and document outstanding services | receipt/payment screens | REUSE |
| Permissions / tenant and branch scope | Account layout/routes | authorization, branch context and module policy | bootstrap permission/navigation payload | REUSE |
| Subscriptions / entitlements | billing routes | `effectiveEntitlement`, operational-write guard | bootstrap entitlement | REUSE |

## Intentionally bounded scope

Phase one modernizes the Home and Dashboard entry experience and connects only routes that
already have a real workflow. Network, Mobile POS, WhatsApp marketing, image invoice sharing,
e-Invoice generation, and the much larger settings expansion are not represented by fake or
cosmetic actions. They require separate domain/runtime work before they can be safely exposed.

## Completion-pass re-audit

- Web Home has bounded server-side transaction/party search, supported commercial filters,
  real print/PDF share, type-aware More actions, and route-backed quick actions.
- Android Home now consumes the same `/api/v1/mobile/account/home` service for bounded
  transactions and parties; it does not calculate balances locally.
- Dashboard sales trend, current/previous month comparison, inventory item/low-stock counts,
  and expense-category breakdown are database aggregates shared with Android.
- Module Selection remains the existing `/workspace/account/settings/modules` workflow, but is
  now placed directly in permission-filtered Menu navigation and removed from Settings content.
- Payment-In/Out, expenses, and transfers remain real standalone domains rather than fake
  `CommercialDocumentType` filters. Unsupported requested filters are: Party-to-Party received
  and paid, Sale FA, Purchase FA, cancelled-as-a-type, Job Work Out, Purchase Job Work, and
  repeating sales. `SUBCONTRACT_PURCHASE` is the existing supported subcontract/job-cost type.
- Mobile POS, transaction SMS settings, loyalty, invitations, reminder settings, WhatsApp
  marketing, invoice-image sharing, and e-Invoice generation remain unavailable. Transaction
  and party settings not already backed by `AccountSettings`, custom fields, numbering series,
  tax, or print profiles remain deferred rather than being exposed as cosmetic toggles.
