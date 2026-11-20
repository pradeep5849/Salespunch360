CREATE TABLE "hosted_job_runs" (
    "jobName" VARCHAR(64) NOT NULL,
    "businessDate" VARCHAR(10) NOT NULL,
    "ownerToken" UUID NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastErrorCode" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hosted_job_runs_pkey" PRIMARY KEY ("jobName", "businessDate")
);

-- Execution leases are server-owned; browser Data API roles must not read or change them.
ALTER TABLE public.hosted_job_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hosted_job_runs FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.hosted_job_runs FROM %I', r);
    END IF;
  END LOOP;
END $$;
