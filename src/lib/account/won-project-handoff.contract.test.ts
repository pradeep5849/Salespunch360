import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const transition = readFileSync("src/lib/leads/transition-with-project.ts", "utf8");
const webAction = readFileSync("src/app/actions/leads.ts", "utf8");
const mobileLeads = readFileSync("src/lib/mobile/leads.ts", "utf8");
const wonProject = readFileSync("src/lib/leads/won-project.ts", "utf8");
const projectsPage = readFileSync("src/app/workspace/account/projects/page.tsx", "utf8");
const simpleProject = readFileSync("src/lib/account/project-simple-workflow.ts", "utf8");
const mobileProjects = readFileSync("src/lib/mobile/account-projects.ts", "utf8");

describe("Won lead project handoff contract", () => {
  it("creates the project in the same transaction as the Won transition", () => {
    expect(transition).toContain("ensureWonLeadProjectInTx");
    expect(transition).toContain('input.toStage === "WON"');
    expect(transition).toContain("Prisma.TransactionIsolationLevel.Serializable");
  });

  it("uses the same atomic transition on Web and Android", () => {
    expect(webAction).toContain("transitionLeadWithProjectForActor");
    expect(mobileLeads).toContain("transitionLeadWithProjectForActor");
    expect(webAction).not.toContain("catch{/* Lead detail performs an idempotent reconciliation");
  });

  it("repairs historical Won leads idempotently when Projects is opened", () => {
    expect(wonProject).toContain("reconcileWonLeadProjectsForActor");
    expect(wonProject).toContain('NOT EXISTS');
    expect(wonProject).toContain('p.\"sourceLeadId\"=l.id');
    expect(projectsPage).toContain("reconcileWonLeadProjectsForActor");
  });

  it("creates an Account customer automatically for manual Web and Android projects", () => {
    expect(simpleProject).toContain("db.customer.create");
    expect(simpleProject).toContain("isAccountCustomer: true");
    expect(simpleProject).toContain("name: siteName || name");
    expect(simpleProject).toContain("customerId: customer.id");
    expect(mobileProjects).toContain("createSimpleProjectForActor");
  });
});
