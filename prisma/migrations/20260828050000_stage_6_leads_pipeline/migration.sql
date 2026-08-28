CREATE TYPE "LeadStage" AS ENUM ('NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST');
CREATE TYPE "LeadSource" AS ENUM ('MANUAL','CUSTOMER_VISIT','REFERRAL','PHONE','EMAIL','WEBSITE','OTHER');
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED','UPDATED','ASSIGNED','STAGE_CHANGED','FOLLOW_UP_CHANGED','WON','LOST','REOPENED');
CREATE TABLE "leads" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "customerId" UUID, "sourceVisitId" UUID,
 "assignedUserId" UUID NOT NULL, "createdByUserId" UUID NOT NULL, "title" VARCHAR(200) NOT NULL,
 "contactName" VARCHAR(150), "phone" VARCHAR(30), "email" VARCHAR(320), "companyName" VARCHAR(200),
 "source" "LeadSource" NOT NULL DEFAULT 'MANUAL', "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
 "estimatedValue" NUMERIC(18,2), "currencyCode" CHAR(3) NOT NULL DEFAULT 'INR', "followUpAt" TIMESTAMP(3),
 "notes" VARCHAR(5000), "lostReason" VARCHAR(1000), "wonAt" TIMESTAMP(3), "lostAt" TIMESTAMP(3),
 "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "leads_value_check" CHECK ("estimatedValue" IS NULL OR ("estimatedValue" >= 0 AND "estimatedValue" <= 9999999999999999.99)),
 CONSTRAINT "leads_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
 CONSTRAINT "leads_source_visit_check" CHECK (("source"='CUSTOMER_VISIT') = ("sourceVisitId" IS NOT NULL)),
 CONSTRAINT "leads_lifecycle_check" CHECK (
  ("stage"='WON' AND "wonAt" IS NOT NULL AND "lostAt" IS NULL AND "lostReason" IS NULL) OR
  ("stage"='LOST' AND "lostAt" IS NOT NULL AND "wonAt" IS NULL AND length(btrim("lostReason")) > 0) OR
  ("stage" NOT IN ('WON','LOST') AND "wonAt" IS NULL AND "lostAt" IS NULL AND "lostReason" IS NULL))
);
CREATE TABLE "lead_activities" (
 "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(), "companyId" UUID NOT NULL, "leadId" UUID NOT NULL, "actorUserId" UUID NOT NULL,
 "type" "LeadActivityType" NOT NULL, "fromStage" "LeadStage", "toStage" "LeadStage", "previousAssignedUserId" UUID, "newAssignedUserId" UUID,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "companies_id_company_key" ON "companies"("id","id");
CREATE UNIQUE INDEX "users_id_company_key" ON "users"("id","companyId");
CREATE UNIQUE INDEX "customers_id_company_key" ON "customers"("id","companyId");
CREATE UNIQUE INDEX "customer_visits_id_company_key" ON "customer_visits"("id","companyId");
CREATE UNIQUE INDEX "leads_id_company_key" ON "leads"("id","companyId");
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "leads" ADD CONSTRAINT "leads_customer_tenant_fkey" FOREIGN KEY ("customerId","companyId") REFERENCES "customers"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "leads" ADD CONSTRAINT "leads_visit_tenant_fkey" FOREIGN KEY ("sourceVisitId","companyId") REFERENCES "customer_visits"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_tenant_fkey" FOREIGN KEY ("assignedUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "leads" ADD CONSTRAINT "leads_creator_tenant_fkey" FOREIGN KEY ("createdByUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "lead_activities" ADD CONSTRAINT "activities_company_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT;
ALTER TABLE "lead_activities" ADD CONSTRAINT "activities_lead_tenant_fkey" FOREIGN KEY ("leadId","companyId") REFERENCES "leads"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "lead_activities" ADD CONSTRAINT "activities_actor_tenant_fkey" FOREIGN KEY ("actorUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "lead_activities" ADD CONSTRAINT "activities_previous_tenant_fkey" FOREIGN KEY ("previousAssignedUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
ALTER TABLE "lead_activities" ADD CONSTRAINT "activities_new_tenant_fkey" FOREIGN KEY ("newAssignedUserId","companyId") REFERENCES "users"("id","companyId") ON DELETE RESTRICT;
CREATE INDEX "leads_company_stage_idx" ON "leads"("companyId","stage");
CREATE INDEX "leads_company_assigned_idx" ON "leads"("companyId","assignedUserId");
CREATE INDEX "leads_company_follow_up_idx" ON "leads"("companyId","followUpAt");
CREATE INDEX "leads_company_created_idx" ON "leads"("companyId","createdAt");
CREATE INDEX "leads_customer_idx" ON "leads"("customerId");
CREATE INDEX "leads_source_visit_idx" ON "leads"("sourceVisitId");
CREATE INDEX "activities_lead_created_idx" ON "lead_activities"("leadId","createdAt");
CREATE INDEX "activities_company_created_idx" ON "lead_activities"("companyId","createdAt");
CREATE FUNCTION prevent_lead_activity_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'lead activity is append-only'; END $$;
CREATE TRIGGER "lead_activities_append_only" BEFORE UPDATE OR DELETE ON "lead_activities" FOR EACH ROW EXECUTE FUNCTION prevent_lead_activity_mutation();
