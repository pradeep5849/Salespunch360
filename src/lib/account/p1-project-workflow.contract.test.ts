import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createForm = readFileSync(
  "src/app/workspace/account/projects/new/project-form.tsx",
  "utf8",
);
const editPage = readFileSync(
  "src/app/workspace/account/projects/[id]/edit/page.tsx",
  "utf8",
);
const detailPage = readFileSync(
  "src/app/workspace/account/projects/[id]/page.tsx",
  "utf8",
);
const actions = readFileSync("src/app/actions/projects.ts", "utf8");
const simpleWorkflow = readFileSync(
  "src/lib/account/project-simple-workflow.ts",
  "utf8",
);
const wonProject = readFileSync("src/lib/leads/won-project.ts", "utf8");
const mobileProjectApi = readFileSync(
  "src/lib/mobile/account-projects.ts",
  "utf8",
);
const androidProjectScreen = readFileSync(
  "android/app/src/main/java/com/salespunch360/mobile/ui/account/project/ProjectScreen.kt",
  "utf8",
);
const migration = readFileSync(
  "prisma/migrations/20260923170000_p1_completed_projects_final/migration.sql",
  "utf8",
);

describe("P1 simple project workflow contract", () => {
  it("keeps manual Create Project but removes customer selection and end date", () => {
    expect(createForm).toContain('name="name"');
    expect(createForm).toContain('name="siteAddress"');
    expect(createForm).toContain('name="siteContactPhone"');
    expect(createForm).toContain('name="startDate"');
    expect(createForm).toContain("Status: Active");
    expect(createForm).not.toContain('name="customerId"');
    expect(createForm).not.toContain('name="targetEndDate"');
  });

  it("exposes only Active and Hold as editable project statuses", () => {
    expect(editPage).toContain('<option value="ACTIVE">Active</option>');
    expect(editPage).toContain('<option value="ON_HOLD">Hold</option>');
    expect(editPage).not.toContain('<option value="COMPLETED"');
    expect(editPage).not.toContain('<option value="CLOSED"');
    expect(editPage).toContain("report-only");
  });

  it("makes completion a one-way report-only action with no reopen action", () => {
    expect(detailPage).toContain("Complete project");
    expect(detailPage).toContain("cannot be reopened");
    expect(detailPage).toContain("Final project report");
    expect(actions).toContain("completeSimpleProject");
    expect(actions).not.toContain("reopenProject");
    expect(simpleWorkflow).toContain('status: "CLOSED"');
    expect(simpleWorkflow).toContain('to: "COMPLETED"');
  });

  it("creates Won Lead projects as Active with lead/site contact details", () => {
    expect(wonProject).toContain('name:lead.title.trim()');
    expect(wonProject).toContain('status:"ACTIVE"');
    expect(wonProject).toContain('startDate:now');
    expect(wonProject).toContain('siteAddress:lead.customer?.address');
    expect(wonProject).toContain('siteContactPhone:lead.phone');
    expect(wonProject).toContain("LEGACY_DEFAULT_ACCOUNT_MODULES");
    expect(wonProject).toContain("sourceLeadId:lead.id");
  });

  it("keeps Android on the same Active Hold Completed workflow", () => {
    expect(androidProjectScreen).toContain('listOf<String?>(null, "ACTIVE", "ON_HOLD", "COMPLETED")');
    expect(androidProjectScreen).toContain('listOf("ACTIVE", "ON_HOLD")');
    expect(androidProjectScreen).toContain('Text("Status: Active")');
    expect(androidProjectScreen).toContain('Text("Complete")');
    expect(androidProjectScreen).toContain("Completed project · report only");
    expect(androidProjectScreen).not.toContain('Pick("Customer"');
    expect(androidProjectScreen).not.toContain("Target end date");
    expect(androidProjectScreen).not.toContain('"REOPEN"');
    expect(androidProjectScreen).not.toContain("Close project");
    expect(mobileProjectApi).toContain('z.literal("COMPLETE")');
    expect(mobileProjectApi).not.toContain("reopenProjectForActor");
  });

  it("migrates legacy Completed projects into the existing immutable final state", () => {
    expect(migration).toContain('SET "status" = \'CLOSED\'');
    expect(migration).toContain('WHERE "status" = \'COMPLETED\'');
    expect(migration).toContain('"actualEndDate"');
    expect(migration).toContain('"closedAt"');
  });
});
