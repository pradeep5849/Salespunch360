-- Existing sessions remain generation 0 and continue to work until the account's
-- next login or password change rotates its generation.
ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sessions" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "mobile_sessions" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
