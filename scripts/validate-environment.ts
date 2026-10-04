import { environmentSchema } from "../src/lib/environment-schema";
const result = environmentSchema.safeParse(process.env);
if (!result.success) {
  console.error(
    "Invalid environment keys:",
    [...new Set(result.error.issues.map((issue) => issue.path.join(".")))].join(
      ", ",
    ),
  );
  process.exitCode = 1;
} else if (!result.data.DIRECT_URL) {
  console.error("Missing environment key: DIRECT_URL");
  process.exitCode = 1;
} else console.info("Environment contract validated.");
