import type { spawnSync } from "node:child_process";
export function productionBuild(options?: { env?: Record<string, string | undefined>; run?: typeof spawnSync }): void;
