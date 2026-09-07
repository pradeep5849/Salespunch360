# Workspace lifecycle foundation

F3B introduces lifecycle state for each product workspace while retaining one shared `User` identity. It does **not** change authorization behavior; F3C will consume these flags in workspace policy.

## Field meanings

- `isActive` is the global identity and security kill switch. It is not employment status.
- `salesRole` is the stable Sales authorization assignment.
- `accountRole` is the stable Account authorization assignment.
- `salesAccessActive` is the Sales workspace lifecycle state.
- `accountAccessActive` is the Account workspace lifecycle state.

A role assignment is retained when workspace access is suspended. Suspending access must not be represented by removing `salesRole` or `accountRole`.

## Future effective access

Sales effective access will eventually require all of:

1. an active global identity (`isActive`);
2. a `salesRole` assignment;
3. active Sales lifecycle state (`salesAccessActive`);
4. a compatible `ProductEdition`; and
5. permission/module policy approval.

Account effective access will eventually require all of:

1. an active global identity (`isActive`);
2. an `accountRole` assignment;
3. active Account lifecycle state (`accountAccessActive`);
4. a compatible `ProductEdition`; and
5. permission/module policy approval.

These are target authorization rules, not behavior activated by F3B.

## Scope boundaries

- Branch access remains shared across Sales and Account.
- Account UI and Account billing are not implemented in F3B.
- Current registration remains SalesPunch360-only until F4.
- When Account or Plus registration is introduced, F4 must make initial lifecycle activation edition-aware.
