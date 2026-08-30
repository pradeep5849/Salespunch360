# Android Phase 7 company management

Phase 7 keeps the native Android app thin: authenticated mobile routes derive the user, role, company, and employee scope from the bearer session, while existing server services remain authoritative.

## Company administration

`COMPANY_ADMIN` can read and update only the existing operational and geofence fields. Operations use `companyOperationsSchema`; geofence changes use `geofenceSettingsSchema`. The mobile payload never supplies tenant scope. Manager and Sales requests are forbidden. Attendance and customer check-in enforcement continue to use the existing server Haversine policy and geofence event audit records.

The subscription view uses `effectiveEntitlement` and current database price versions. It hides Manager seat usage for `SALES_ONLY`, never counts Company Admin as a paid seat, and offers no checkout or payment action while the existing provider is `UNCONFIGURED`.

## Targets and reports

Targets reuse the Stage 8 target service with an authenticated mobile actor. Existing role hierarchy, optimistic version checks, subscription write policy, India date boundaries, Won-lead aggregation, and target status calculations remain server-side. Company Admin can manage visible company employees, Manager can manage only the existing assigned-team scope, and Sales has read-only access to personal targets.

Native report filters send date text and an employee identifier selected only from server-returned options. The report service applies `resolveEmployeeScope` and interprets date boundaries in `Asia/Kolkata`. The existing geofence breach report is available without adding a map SDK or inventing a new breach engine.

`SUPER_ADMIN` remains unsupported by the mobile session boundary and has no Android navigation or price-editing controls.
