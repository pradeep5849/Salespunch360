import { Prisma, PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";
/** Compare generated-client scalar columns with the connected database, without writes. */
export function missingRuntimeColumns(models, actualColumns) {
  const actual = new Set(
    actualColumns.map((row) => `${row.table_name}.${row.column_name}`),
  );
  return models
    .flatMap((model) =>
      model.fields
        .filter((field) => field.kind !== "object")
        .map(
          (field) =>
            `${model.dbName ?? model.name}.${field.dbName ?? field.name}`,
        ),
    )
    .filter((column) => !actual.has(column))
    .sort();
}
export async function checkRuntimeSchema() {
  const source = process.env.DATABASE_URL;
  if (!source)
    throw new Error(
      "DATABASE_URL is required for the read-only runtime schema check.",
    );
  const namespace = new URL(source).searchParams.get("schema") ?? "public";
  const client = new PrismaClient();
  try {
    const columns =
      await client.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=${namespace}`;
    const missing = missingRuntimeColumns(
      Prisma.dmmf.datamodel.models,
      columns,
    );
    if (missing.length)
      throw new Error(
        `Runtime database schema is missing ${missing.length} generated-client columns: ${missing.join(", ")}. Verify the release database target and migration status; do not mark unapplied migrations as applied.`,
      );
    console.info(
      "Runtime schema check passed: all generated-client scalar columns exist.",
    );
  } finally {
    await client.$disconnect();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkRuntimeSchema().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Runtime schema check failed.",
    );
    process.exitCode = 1;
  });
}
