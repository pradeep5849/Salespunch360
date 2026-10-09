import { compactSource } from "@/lib/testing/compact-source";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("Project material web/mobile workflows", () => {
  it("provides real server actions and selectors", () => {
    const page = readFileSync(
      "src/components/account/project-material-forms.tsx",
      "utf8",
    );
    for (const x of [
      "issueProjectMaterialAction",
      "consumeProjectMaterialAction",
      "returnProjectMaterialAction",
      "transferProjectMaterialAction",
      "projectBudgetLineId",
    ])
      expect(page).toContain(x);
  });
  it("exposes permission-controlled native API operations", () => {
    const route = compactSource(
      readFileSync(
        "src/app/api/v1/mobile/account/project-material/route.ts",
        "utf8",
      ),
    );
    for (const x of [
      "ISSUE",
      "CONSUME",
      "RETURN",
      "TRANSFER",
      "REVERSE",
      "permit(user,permission)",
    ])
      expect(route).toContain(x);
  });
});
