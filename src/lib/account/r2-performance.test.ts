import {readFileSync,readdirSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {PROJECT_MAX_PAGE_SIZE,PROJECT_PAGE_SIZE,projectPageInput} from "./projects";

describe("R2 bounded project queries",()=>{
 it("defaults and clamps direct page-size abuse",()=>{
  expect(projectPageInput()).toEqual({page:1,pageSize:PROJECT_PAGE_SIZE});
  expect(projectPageInput({page:"2",pageSize:"999999"})).toEqual({page:2,pageSize:PROJECT_MAX_PAGE_SIZE});
  expect(projectPageInput({page:"bad",pageSize:"-2"})).toEqual({page:1,pageSize:1});
 });
 it("keeps project tenant/branch scope while applying deterministic pagination",()=>{
  const source=readFileSync("src/lib/account/projects.ts","utf8");
  expect(source).toContain("where = projectRecordScope(actor, ids)");
  expect(source).toContain('orderBy: [{ createdAt: "desc" }, { id: "desc" }]');
  expect(source).toContain("take: paging.pageSize");
 });
 it("bounds and exposes navigation for large project detail histories",()=>{
  const source=readFileSync("src/lib/account/projects.ts","utf8");
  for(const collection of ["tasks", "documents", "quotationDocuments", "audits"]){
   const start=source.indexOf(`${collection}: {`,source.indexOf("export async function getProject"));
   expect(start).toBeGreaterThan(0);
   expect(source.slice(start,start+300)).toContain("take:paging.pageSize");
  }
  const page=readFileSync("src/app/workspace/account/projects/[id]/page.tsx","utf8");
  for(const key of ["tasksPage","documentsPage","boqsPage","commercialPage","auditsPage"])expect(page).toContain(`keyName=\"${key}\"`);
 });
});

describe("R2 query/index contracts",()=>{
 it("batches advanced visit classification rather than issuing one query per row",()=>{
  const source=readFileSync("src/lib/reports/check-ins.ts","utf8");
  expect(source).toContain("priorVisitIds");
  expect(source).not.toContain("Promise.all(visits.map(async");
 });
 it("adds only a forward migration with indexes matching bounded filters",()=>{
  const migration=readFileSync("prisma/migrations/20260913150000_r2_performance_indexes/migration.sql","utf8");
  expect(migration).toContain('"attendances"("companyId", "branchId", "userId", "startedAt")');
  expect(migration).toContain('"customer_visits"("companyId", "branchId", "userId", "checkedInAt")');
  expect(migration).toContain('"location_points"("companyId", "branchId", "userId", "capturedAt")');
  expect(migration).toContain('"commercial_documents"("companyId", "branchId", "status", "type", "issueDate")');
  expect(migration).toContain('"projects"("companyId", "branchId", "createdAt")');
 });
 it("sorts R2 after the latest historical Y invariant migration",()=>{
  const migrations=readdirSync("prisma/migrations",{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort();
  expect(migrations.slice(-2)).toEqual(["20260913100000_y02_y03_tenant_invariants","20260913150000_r2_performance_indexes"]);
 });
});
