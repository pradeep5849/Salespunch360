/** Retry aborted transactions; unique conflicts require an explicit replay key. */
export async function retrySerializable<T>(
  operation: () => Promise<T>,
  attempts = 3,
  replayUniqueTarget?: readonly string[],
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      let retryable = false;
      if (error instanceof Error && "code" in error) {
        const meta =
          "meta" in error && error.meta && typeof error.meta === "object"
            ? error.meta
            : undefined;
        retryable =
          error.code === "P2034" ||
          (error.code === "P2010" &&
            !!meta &&
            "code" in meta &&
            ["40001", "40P01"].includes(String(meta.code)));
        // Two snapshots may miss the same request and yield P2002 rather than
        // a serialization error. Only callers validating replay content opt in.
        if (
          error.code === "P2002" &&
          replayUniqueTarget?.length &&
          meta &&
          "target" in meta &&
          Array.isArray(meta.target)
        ) {
          const target = meta.target;
          retryable =
            target.length === replayUniqueTarget.length &&
            replayUniqueTarget.every((field) => target.includes(field));
        }
      }
      if (attempt >= attempts || !retryable) throw error;
    }
  }
}
