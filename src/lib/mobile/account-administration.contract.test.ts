import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(p, "utf8");
describe("native Account administration boundary", () => {
  it("derives tenant and permission on server", () => {
    const s = read("src/lib/mobile/account-administration.ts");
    expect(s).toContain("mobileAccountActor");
    expect(s).toContain("canUsePermission");
    expect(s).toContain("assertOperationalWrite");
    expect(s).not.toContain("raw.companyId");
  });
  it("routes phase 11 to Compose without Account WebView", () => {
    const s = read(
      "android/app/src/main/java/com/salespunch360/mobile/ui/account/NativeAccountApp.kt",
    );
    expect(s).toContain("AccountAdministrationScreen");
    expect(s).not.toContain("AccountWorkspaceScreen");
    expect(
      read(
        "android/app/src/main/java/com/salespunch360/mobile/MainActivity.kt",
      ),
    ).not.toContain("AccountWorkspaceScreen(");
  });
  it("documents every pending route specifically", () => {
    const d = JSON.parse(read("docs/account-native-parity.json"));
    for (const r of d.routes.filter(
      (x: { classification: string }) => x.classification === "PENDING_NATIVE",
    )) {
      expect(r.android, r.route).toBeTruthy();
      expect(r.api, r.route).toBeTruthy();
      expect(r.reason, r.route).not.toContain("Requires a feature-specific");
    }
  });
});
