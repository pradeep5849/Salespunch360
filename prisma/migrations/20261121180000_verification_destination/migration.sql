ALTER TABLE "email_verification_tokens" ADD COLUMN "destinationEmail" VARCHAR(320);
-- Old links have no destination proof. They remain stored but are rejected until reissued.
