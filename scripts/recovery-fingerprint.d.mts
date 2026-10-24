import type { Prisma } from "@prisma/client";
export type RecoveryFingerprint = {
  rows: Array<{ table: string; count: string; digest: string }>;
  schema: Array<{ kind: string; name: string; definition: string }>;
};
export function fingerprint(
  reader: Pick<Prisma.TransactionClient, "$queryRaw" | "$queryRawUnsafe">,
): Promise<RecoveryFingerprint>;
export function assertRestoredState(
  expected: RecoveryFingerprint,
  actual: RecoveryFingerprint,
): void;
