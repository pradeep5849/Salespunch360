import { z } from "zod";
import {
  confirmNumberingRestart,
  previewNumberingRestart,
} from "./numbering-restart";
export async function numberingRestartRequest(
  actor: Parameters<typeof previewNumberingRestart>[0],
  raw: unknown,
) {
  const body = z
    .object({ action: z.enum(["PREVIEW", "CONFIRM"]), input: z.unknown() })
    .strict()
    .parse(raw);
  return body.action === "PREVIEW"
    ? previewNumberingRestart(actor, body.input)
    : confirmNumberingRestart(actor, body.input);
}
