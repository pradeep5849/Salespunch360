import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (p: string) => readFileSync(p, "utf8");
describe("final native Account parity", () => {
  it("has no functional gaps", () => {
    const p = JSON.parse(read("docs/account-native-parity.json"));
    expect(p.validationGate.functionalGapCount).toBe(0);
    for (const r of p.routes.filter(
      (x: { classification: string }) => x.classification === "PENDING_NATIVE",
    ))
      expect(r.reason).toMatch(
        /validation pending|Android CI\/device validation pending|Android validation pending/,
      );
  });
  it("removes Account WebView and handoff infrastructure", () => {
    for (const p of [
      "android/app/src/main/java/com/salespunch360/mobile/ui/AccountWorkspaceScreen.kt",
      "android/app/src/main/java/com/salespunch360/mobile/web/AccountWebPolicy.kt",
      "src/app/api/v1/mobile/web-session/route.ts",
    ])
      expect(existsSync(p)).toBe(false);
    expect(
      read(
        "android/app/src/main/java/com/salespunch360/mobile/MainActivity.kt",
      ),
    ).toContain("NativeAccountAuthenticatedApp");
  });
  it("uses authoritative utility services", () => {
    const s = read("src/lib/mobile/account-administration.ts");
    for (const name of [
      "previewAccountImportForActor",
      "executeAccountImportForActor",
      "exportAccountDataForActor",
      "createAccountBackupForActor",
      "restoreMasterForActor",
      "uploadAuthorizedSignatureForActor",
    ])
      expect(s).toContain(name);
  });
});
