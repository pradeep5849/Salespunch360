# Workspace lifecycle foundation

F3B introduced lifecycle state for each product workspace while retaining one shared `User` identity. F3C now consumes those flags in the canonical web/server workspace policy.

## Field meanings

- `isActive` is the global identity and security kill switch. It is not employment status.
- `salesRole` is the stable Sales authorization assignment.
- `accountRole` is the stable Account authorization assignment.
- `salesAccessActive` is the Sales workspace lifecycle state.
- `accountAccessActive` is the Account workspace lifecycle state.

A role assignment is retained when workspace access is suspended. Suspending access must not be represented by removing `salesRole` or `accountRole`.

## Canonical effective access

Sales workspace access requires all of:

1. an active global identity (`isActive`);
2. company membership (`companyId` is non-null) and a non-`SUPER_ADMIN` identity;
3. a `salesRole` assignment;
4. active Sales lifecycle state (`salesAccessActive`); and
5. a `ProductEdition` of `SALESPUNCH360` or `SALESPUNCH360_PLUS`.

Account workspace access requires all of:

1. an active global identity (`isActive`);
2. company membership (`companyId` is non-null) and a non-`SUPER_ADMIN` identity;
3. an `accountRole` assignment;
4. active Account lifecycle state (`accountAccessActive`); and
5. a `ProductEdition` of `SALESPUNCH360_ACCOUNT` or `SALESPUNCH360_PLUS`.

Authentication session validity is not workspace authorization. Likewise, tenant membership is not product workspace authorization, and a role assignment is not an active workspace entitlement. Lifecycle flags independently suspend each workspace without removing its role, but even a stale `true` lifecycle flag cannot override `ProductEdition`.

## Scope boundaries

- Branch access remains shared across Sales and Account.
- Account UI and Account billing are not implemented in F3B.
- Current registration remains SalesPunch360-only until F4.
- When Account or Plus registration is introduced, F4 must make initial lifecycle activation edition-aware.
- Module permission enforcement remains deferred to F3E.
- Migration of downstream legacy Sales services to canonical guards remains deferred to F3F.
