ALTER TABLE "account_settlements" ADD COLUMN "billingName" VARCHAR(240), ADD COLUMN "billingAddress" VARCHAR(2000);
CREATE TABLE "payment_attachments" (
 "id" UUID NOT NULL PRIMARY KEY,
 "companyId" UUID NOT NULL,
 "settlementId" UUID NOT NULL,
 "position" INTEGER NOT NULL,
 "displayName" VARCHAR(240) NOT NULL,
 "mimeType" VARCHAR(120) NOT NULL,
 "sizeBytes" INTEGER NOT NULL,
 "contentHash" CHAR(64) NOT NULL,
 "storageKey" VARCHAR(512) NOT NULL,
 "uploadedById" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "payment_attachment_bounds" CHECK ("position" BETWEEN 0 AND 49 AND "sizeBytes" BETWEEN 1 AND 10485760 AND "mimeType" IN ('application/pdf','image/png','image/jpeg') AND "contentHash" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "payment_attachment_company_fk" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
 CONSTRAINT "payment_attachment_parent_fk" FOREIGN KEY ("companyId","settlementId") REFERENCES "account_settlements"("companyId","id") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY IMMEDIATE,
 CONSTRAINT "payment_attachment_uploader_fk" FOREIGN KEY ("companyId","uploadedById") REFERENCES "users"("companyId","id") ON DELETE NO ACTION ON UPDATE RESTRICT DEFERRABLE INITIALLY IMMEDIATE
);
CREATE UNIQUE INDEX "payment_attachments_companyId_settlementId_position_key" ON "payment_attachments"("companyId","settlementId","position");
CREATE INDEX "payment_attachments_companyId_storageKey_idx" ON "payment_attachments"("companyId","storageKey");
CREATE FUNCTION guard_payment_attachment_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.company_restore_company_id',true) = (CASE WHEN TG_OP='DELETE' THEN OLD."companyId"::text ELSE NEW."companyId"::text END) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_OP='DELETE' AND current_setting('app.account_cleanup_company_id',true)=OLD."companyId"::text THEN RETURN OLD; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'PAYMENT_ATTACHMENT_HISTORY_IMMUTABLE'; END IF;
 IF current_setting('app.payment_attachment_save_id',true) IS DISTINCT FROM NEW."settlementId"::text THEN RAISE EXCEPTION 'PAYMENT_ATTACHMENT_SAVE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "payment_attachment_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "payment_attachments" FOR EACH ROW EXECUTE FUNCTION guard_payment_attachment_history();
-- All access goes through the authenticated backend and its tenant/branch checks.
REVOKE ALL ON "payment_attachments" FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE payment_attachments FROM %I',r); END IF; END LOOP; END $$;
CREATE FUNCTION guard_payment_billing_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.company_restore_company_id',true)=NEW."companyId"::text THEN RETURN NEW; END IF;
 IF OLD."billingName" IS DISTINCT FROM NEW."billingName" OR OLD."billingAddress" IS DISTINCT FROM NEW."billingAddress" THEN RAISE EXCEPTION 'PAYMENT_BILLING_HISTORY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "payment_billing_history_guard" BEFORE UPDATE ON "account_settlements" FOR EACH ROW EXECUTE FUNCTION guard_payment_billing_history();
