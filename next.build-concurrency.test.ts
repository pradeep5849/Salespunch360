import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

it("bounds Next build workers when the shared host exposes 64 CPUs", () => {
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        import configModule from 'next/dist/server/config.js';
        import shared from 'next/dist/server/config-shared.js';
        const loadConfig = configModule.default ?? configModule;
        const config = await loadConfig('phase-production-build', process.cwd());
        console.log('HOSTINGER_CONFIG_RESULT=' + JSON.stringify({
          defaultWorkers: shared.defaultConfig.experimental.cpus,
          workers: config.experimental.cpus,
          memoryFanout: config.experimental.memoryBasedWorkersCount,
          staticConcurrency: config.experimental.staticGenerationMaxConcurrency,
          serverActionLimit: config.experimental.serverActions.bodySizeLimit,
          tracedFonts: config.outputFileTracingIncludes['/*'],
        }));
      `,
    ],
    {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, CIRCLE_NODE_TOTAL: "64", NODE_ENV: "production" },
    },
  );
  const line = result
    .split("\n")
    .find((value) => value.startsWith("HOSTINGER_CONFIG_RESULT="));
  expect(line).toBeDefined();
  const config = JSON.parse(line!.slice("HOSTINGER_CONFIG_RESULT=".length));
  expect(config.defaultWorkers).toBe(63);
  expect(config.workers).toBe(1);
  expect(config.memoryFanout).toBe(false);
  expect(config.staticConcurrency).toBe(1);
  expect(config.serverActionLimit).toBe("6mb");
  expect(config.tracedFonts).toContain("./assets/fonts/*.ttf");
}, 35000);
