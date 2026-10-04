import { randomUUID } from "node:crypto";
import { logEvent } from "./lib/logging";
export function onRequestError(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
  logEvent("error", {
    category: "WEB_REQUEST",
    correlationId: randomUUID(),
    code,
  });
}
