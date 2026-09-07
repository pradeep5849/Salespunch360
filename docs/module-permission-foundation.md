# Static module permission foundation

F3E defines module permissions as deterministic TypeScript mappings. There are no permission tables, per-user ACL editors, or permission migrations. Permissions have explicit `SHARED`, `SALES`, or `ACCOUNT` ownership, and legacy `Role` is never permission authority.

An effective Sales or Account permission requires an active global identity, company membership, an active corresponding workspace lifecycle, an explicit corresponding workspace role, and a `ProductEdition` that permits that workspace. Shared tenant permissions likewise require at least one active tenant workspace; `PROFILE_SELF` requires an active authenticated identity. `SUPER_ADMIN` platform support authority remains separate and receives no ordinary tenant permissions.

Module permission is not record-level scope. Self/team/company visibility, target-user restrictions, branch scope, and ownership rules remain policy/service responsibilities. In particular, `SALES_USER_ADMIN` for an Additional Admin does not authorize creating another Additional Admin, changing the Primary Admin, or transferring ownership. `BRANCH_ASSIGN` and `SECURITY_RESET_PASSWORD` also remain subject to target-user restrictions.

Navigation is not a security boundary and is intentionally unchanged in F3E. F3F will migrate existing Sales server services before navigation consumes this map. The Account permission map is only a foundation; it does not implement Account modules, UI, or billing. Dynamic per-user ACLs are intentionally outside F3.

Future role changes are security-sensitive: they must lock the identity, rotate `sessionVersion`, and remove push devices, web sessions, and mobile sessions.
