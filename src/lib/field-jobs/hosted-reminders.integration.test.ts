import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runHostedFollowUpReminders } from "./hosted-reminders";

const url = process.env.HOSTED_REMINDER_TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
suite("hosted reminder durable leases", () => {
  const client = new PrismaClient({ datasources: { db: { url } } });
  const dates = ["2098-01-01", "2098-01-02", "2098-01-03"];
  beforeAll(() => {
    const target = new URL(url!);
    if (
      !["127.0.0.1", "localhost"].includes(target.hostname) ||
      !target.pathname.endsWith("_ci")
    )
      throw new Error("Isolated local *_ci database required");
  });
  afterAll(async () => {
    await client.hostedJobRun.deleteMany({
      where: {
        jobName: "daily-follow-up-reminders",
        businessDate: { in: dates },
      },
    });
    await client.$disconnect();
  });
  it("allows one concurrent worker and preserves completion across a restart", async () => {
    let calls = 0;
    const now = new Date(dates[0] + "T03:00:00Z");
    const generate = async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 50));
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        runHostedFollowUpReminders(now, { client, generate }),
      ),
    );
    expect(results.filter((x) => x === "completed")).toHaveLength(1);
    expect(calls).toBe(1);
    expect(await runHostedFollowUpReminders(now, { client, generate })).toBe(
      "already-claimed",
    );
    expect(calls).toBe(1);
  });
  it("recovers a failed worker after lease expiry without completing failed work", async () => {
    const now = new Date(dates[1] + "T03:00:00Z");
    expect(
      await runHostedFollowUpReminders(now, {
        client,
        generate: async () => {
          throw new Error("private failure");
        },
      }),
    ).toBe("retry-pending");
    const where = {
      jobName_businessDate: {
        jobName: "daily-follow-up-reminders",
        businessDate: dates[1],
      },
    };
    expect(await client.hostedJobRun.findUnique({ where })).toMatchObject({
      completedAt: null,
      attempts: 1,
      lastErrorCode: "REMINDER_SWEEP_FAILED",
    });
    await client.hostedJobRun.update({
      where,
      data: { leaseUntil: new Date(0) },
    });
    expect(
      await runHostedFollowUpReminders(now, {
        client,
        generate: async () => {},
      }),
    ).toBe("completed");
    expect(await client.hostedJobRun.findUnique({ where })).toMatchObject({
      attempts: 2,
      lastErrorCode: null,
      completedAt: expect.any(Date),
    });
  });
  it("keeps run records inaccessible to a non-owner client even if table grants are added", async () => {
    await runHostedFollowUpReminders(new Date(dates[2] + "T03:00:00Z"), {
      client,
      generate: async () => {},
    });
    await client.$executeRawUnsafe(
      "CREATE ROLE hosted_reminder_client_probe NOLOGIN",
    );
    try {
      await client.$executeRawUnsafe(
        "GRANT USAGE ON SCHEMA public TO hosted_reminder_client_probe",
      );
      await client.$executeRawUnsafe(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON public.hosted_job_runs TO hosted_reminder_client_probe",
      );
      await client.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          "SET LOCAL ROLE hosted_reminder_client_probe",
        );
        expect(await tx.hostedJobRun.findMany()).toEqual([]);
        expect(
          (
            await tx.hostedJobRun.updateMany({
              data: { lastErrorCode: "client-edit" },
            })
          ).count,
        ).toBe(0);
        expect((await tx.hostedJobRun.deleteMany()).count).toBe(0);
      });
      await expect(
        client.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            "SET LOCAL ROLE hosted_reminder_client_probe",
          );
          await tx.hostedJobRun.create({
            data: {
              jobName: "client-insert",
              businessDate: dates[2],
              ownerToken: "11111111-1111-4111-8111-111111111111",
              leaseUntil: new Date(),
            },
          });
        }),
      ).rejects.toThrow(/row-level security/i);
    } finally {
      await client.$executeRawUnsafe(
        "REVOKE ALL ON public.hosted_job_runs FROM hosted_reminder_client_probe",
      );
      await client.$executeRawUnsafe(
        "REVOKE USAGE ON SCHEMA public FROM hosted_reminder_client_probe",
      );
      await client.$executeRawUnsafe("DROP ROLE hosted_reminder_client_probe");
    }
  });
});
