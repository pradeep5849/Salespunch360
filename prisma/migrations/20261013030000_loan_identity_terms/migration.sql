-- Optional loan identity/terms; preserve existing records without invented metadata.
ALTER TABLE "loans"
 ADD COLUMN "displayName" VARCHAR(240),
 ADD COLUMN "loanAccountNumber" VARCHAR(160),
 ADD COLUMN "description" VARCHAR(2000),
 ADD COLUMN "durationMonths" INTEGER;
ALTER TABLE "loans" ADD CONSTRAINT "loans_duration_months_range" CHECK ("durationMonths" IS NULL OR "durationMonths" BETWEEN 1 AND 1200);
