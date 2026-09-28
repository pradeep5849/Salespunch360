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
