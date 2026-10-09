import { expect, it } from "vitest";
import { z } from "zod";
import { AuthorizationError } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { accountAction } from "./action-feedback";
it("confirms success only after the mutation resolves", async () => {
  let finish!: (v: string) => void;
  const pending = accountAction(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  finish("/workspace/account/assets/asset");
  await expect(pending).resolves.toEqual({
    kind: "success",
    message: "Saved successfully",
    redirectTo: "/workspace/account/assets/asset",
  });
});
it("returns field-associated safe validation errors", async () => {
  const result = await accountAction(async () => {
    z.object({ name: z.string().min(1) }).parse({ name: "" });
  });
  expect(result.kind).toBe("error");
  expect(result.fieldErrors?.name).toBeTruthy();
  expect(result).not.toHaveProperty("redirectTo");
});
it("does not expose unexpected database details or announce success", async () => {
  const result = await accountAction(async () => {
    throw new Error("postgresql://private:secret/financial");
  });
  expect(result).toEqual({
    kind: "error",
    message: "Unable to save. Check the details and try again.",
  });
});
it("provides actionable stale-lifecycle and authorization feedback", async () => {
  expect(
    await accountAction(async () => {
      throw new Error("RETURN_ASSET_FIRST");
    }),
  ).toMatchObject({
    kind: "error",
    message: "Return the assigned asset before changing its status.",
  });
  expect(
    await accountAction(async () => {
      throw new AuthorizationError();
    }),
  ).toMatchObject({
    kind: "error",
    message: "Your permission or module settings do not allow this action.",
  });
});
it("preserves framework authentication redirects", async () => {
  await expect(
    accountAction(async () => {
      redirect("/sign-in");
    }),
  ).rejects.toThrow("NEXT_REDIRECT");
});
