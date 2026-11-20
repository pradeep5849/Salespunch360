import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { productionBuild } from "./production-build.mjs";
const env = { DATABASE_URL: "postgresql://test@localhost/release_ci", DIRECT_URL: "postgresql://test@localhost/release_ci" };
describe("production migration release gate", () => {
  it("keeps the hosting build entrypoint bound to the migration gate",()=>{
    const pkg=JSON.parse(readFileSync("package.json","utf8"));
    expect(pkg.scripts.build).toBe("node scripts/production-build.mjs");
    expect(pkg.scripts.prebuild).toBe("node scripts/public-styles.mjs --check && prisma generate");
  });
  it("applies and verifies migrations and runtime columns before compiling the app", () => {
    const run = vi.fn().mockReturnValue({status:0});
    productionBuild({env,run});
    expect(run.mock.calls.map(call => call[1].slice(1))).toEqual([
      ["migrate","deploy"],["migrate","status"],[],["build"],
    ]);
    expect(run.mock.calls[2][1][0]).toBe("scripts/check-runtime-schema.mjs");
  });
  it.each([0,1,2])("blocks compilation after gate %s fails without printing credentials", failure => {
    const run=vi.fn().mockImplementation(() => ({status:run.mock.calls.length===failure+1?1:0,stderr:"postgresql://sensitive:password@private/database"}));
    expect(()=>productionBuild({env,run})).toThrow(/Production build blocked/);
    expect(run).toHaveBeenCalledTimes(failure+1);
  });
  it("rejects missing configuration and transaction-pooler migration connections",()=>{
    const run=vi.fn();
    expect(()=>productionBuild({env:{},run})).toThrow("DATABASE_URL");
    expect(()=>productionBuild({env:{...env,DIRECT_URL:"postgresql://test@localhost:6543/db"},run})).toThrow("transaction pooler");
    expect(run).not.toHaveBeenCalled();
  });
});
