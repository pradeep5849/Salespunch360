import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const salesHeader = readFileSync(new URL("./workspace-header.tsx", import.meta.url), "utf8");
const workspaceLayout = readFileSync(new URL("../../app/workspace/layout.tsx", import.meta.url), "utf8");
const accountMenu = readFileSync(new URL("../../app/workspace/account/menu/page.tsx", import.meta.url), "utf8");

describe("Sales and Account workspace shell separation", () => {
  it("does not render the Sales header on Account workspace routes", () => {
    expect(salesHeader).toContain('pathname.startsWith("/workspace/account")');
    expect(salesHeader).toContain("return null");
  });

  it("hides the Sales header when Account Employees uses the shared employee route", () => {
    expect(workspaceLayout).toContain('activeWorkspace={workspace.effectiveWorkspace ?? "SALES"}');
    expect(salesHeader).toContain('activeWorkspace==="ACCOUNT"&&pathname.startsWith("/workspace/employees")');
  });

  it("keeps the Sales drawer employee link inside the Sales workspace", () => {
    expect(salesHeader).toContain('["♟","Employees","/workspace/employees"]');
  });

  it("keeps the Account workspace switch back to Sales", () => {
    expect(accountMenu).toContain('name="workspace" value="SALES"');
    expect(accountMenu).toContain("Switch to Sales");
  });
});
