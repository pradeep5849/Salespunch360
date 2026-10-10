import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { retrySerializable } from "./transaction-retry";
/** Compose existing financial services in one transaction without nested commits. */
export function inAccountTransaction<T>(
  transaction: Prisma.TransactionClient | undefined,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return transaction
    ? work(transaction)
    : retrySerializable(() =>
        db.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }),
      );
}
